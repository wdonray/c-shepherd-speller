#!/usr/bin/env node
/**
 * Dependency audit gate (CI).
 *
 * `npm audit` has no ignore-list mechanism, so this script is the gate:
 * it fails unless every reported finding is a documented allowlist entry.
 *
 * Run: `node scripts/audit-gate.mjs` (CI runs it; the npm audit endpoint is
 * unreachable from the dev VM, so CI is the source of truth for results).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * GHSA advisory ID -> why it is accepted.
 * Every `npm audit` finding must be listed here or the gate fails.
 * Adding an entry needs a written reason; removing one happens when the
 * underlying issue is fixed (e.g. the Next.js entry leaves with E2).
 */
export const ALLOWLIST = {
  'GHSA-7RQJ-J65F-68WH':
    '@auth/core via next-auth v4 (critical): no patched release exists in the v4 line — fixed only in @auth/core 0.41.3 / 4.24.15 / 5.0.0-beta.32, which next-auth@4 cannot take. Auth stack is locked to v4; not practically exploitable here (single Google OAuth provider, no Email provider, app never deployed).',
  'GHSA-X445-F3H2-J279': '@auth/core via next-auth v4 (medium): same as above — no patched release in the v4 line.',
  'GHSA-XMF8-CVQR-RFGJ': '@auth/core via next-auth v4 (high): same as above — no patched release in the v4 line.',
  'GHSA-VFJ7-8CJW-P6XM':
    'braces@3.0.3 (high): no patched version exists — latest 3.0.3 is within the vulnerable range. Transitive via micromatch; build-time glob expansion only, never handles untrusted input at runtime.',
  'GHSA-GRV7-FG5C-XMJG': 'braces@3.0.3 (high): same as above — no patched version exists.',
  'GHSA-4342-X723-CH2F':
    'next@15.4.6 (critical, middleware redirect SSRF): TEMPORARY — owned by the E2 Next.js 16 upgrade (the next PR in the revival plan). Remove this entry in E2.',
  // --- TEMPORARY: 30 further next@15.4.6 advisories, all owned by E2. ---
  // E2 must upgrade to next >= 16.3.3, not just "16.x": GHSA-2xp9-vwfh-vxw4
  // (critical RCE) and GHSA-p293-qw3h-jr36 affect 16.x below 16.3.3, and most
  // of the rest affect 16.x below 16.2.5/16.2.11. Verified 2026-10-05 via the
  // GitHub Advisory API. Remove this whole block in E2; the gate will fail
  // if the upgrade does not clear them.
  'GHSA-267C-6GRR-H53F': 'next@15.4.6 (high): TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-26HH-7CQF-HHC6': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-2XP9-VWFH-VXW4':
    'next@15.4.6 (critical RCE): TEMPORARY — E2 Next.js >= 16.3.3 upgrade (this one needs >= 16.3.3). Remove in E2.',
  'GHSA-36QX-FR4F-26G5': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-3G8H-86W9-WVMQ': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-3X4C-7XQ6-9PQ8': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-4633-3J49-MH5Q': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-492V-C6PP-MQQV': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-4C39-4CCG-62R3': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-68G3-V927-F742': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-89XV-2M56-2M9X': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-8H8Q-6873-Q5FJ': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-955P-X3MX-JCVP': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-9G9P-9GW9-JX7F': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-9QR9-H5GF-34MP': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-C4J6-FC7J-M34R': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-FFHC-5MCF-PF4Q': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-GGV3-7P47-PFV8': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-GX5P-JG67-6X7H': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-H25M-26QC-WCJF': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-H64F-5H5J-JQJH': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-M99W-X7HQ-7VFJ': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-MG66-MRH9-M8JX': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-MWV6-3258-Q52C': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-P293-QW3H-JR36':
    'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade (this one needs >= 16.3.3). Remove in E2.',
  'GHSA-P9J2-GV94-2WF4': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-Q4GF-8MX6-V5V3': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-VFV6-92FF-J949': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-W37M-7FHW-FMV9': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
  'GHSA-WFC6-R584-VFW7': 'next@15.4.6: TEMPORARY — E2 Next.js >= 16.3.3 upgrade. Remove in E2.',
}

const GHSA_RE = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/gi

/**
 * Extract GHSA IDs from `npm audit --json` output.
 * Handles the npm v7+ `vulnerabilities` shape (advisory URLs in `via`) with
 * a fallback for the legacy numeric-keyed `advisories` shape.
 */
export function ghsaIdsFromAudit(audit) {
  const ids = new Set()
  const vulns = audit?.vulnerabilities ?? audit?.advisories ?? {}
  for (const vuln of Object.values(vulns)) {
    for (const via of vuln?.via ?? []) {
      if (typeof via !== 'object' || via === null) continue
      const m = typeof via.url === 'string' ? via.url.match(GHSA_RE) : null
      if (m) ids.add(m[0].toUpperCase())
    }
    if (typeof vuln?.url === 'string') {
      const m = vuln.url.match(GHSA_RE)
      if (m) ids.add(m[0].toUpperCase())
    }
  }
  return ids
}

/** GHSA IDs in `ids` that are not in the allowlist, sorted. Comparison is case-insensitive. */
export function findUnallowlisted(ids, allowlist = ALLOWLIST) {
  const allowed = new Set(Object.keys(allowlist).map((k) => k.toUpperCase()))
  return [...ids]
    .map((id) => id.toUpperCase())
    .filter((id) => !allowed.has(id))
    .sort()
}

/**
 * For each GHSA ID, the package names in `npm audit --json` whose `via`
 * chain references it (with the reported range and fix availability).
 * Used for the failure report so triage doesn't need a second lookup.
 */
export function packagesForAdvisories(audit, ids) {
  const wanted = new Set(ids.map((id) => id.toUpperCase()))
  const found = new Map()
  const vulns = audit?.vulnerabilities ?? audit?.advisories ?? {}
  for (const [name, vuln] of Object.entries(vulns)) {
    for (const via of vuln?.via ?? []) {
      if (typeof via !== 'object' || via === null || typeof via.url !== 'string') continue
      const m = via.url.match(GHSA_RE)
      const id = m ? m[0].toUpperCase() : null
      if (id && wanted.has(id)) {
        if (!found.has(id)) found.set(id, new Set())
        found
          .get(id)
          .add(
            `${name}${vuln?.range ? `@${vuln.range}` : ''}${via?.fixAvailable ? ` (fix: ${typeof via.fixAvailable === 'string' ? via.fixAvailable : 'available'})` : ''}`
          )
      }
    }
  }
  return new Map([...found].map(([id, pkgs]) => [id, [...pkgs]]))
}

export function runAuditJson(execFn = execFileSync) {
  try {
    return execFn('npm', ['audit', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (err) {
    // npm audit exits non-zero when it reports findings; the JSON is still on stdout.
    const out = err.stdout?.toString() ?? ''
    if (!out.trim()) throw new Error(`npm audit produced no JSON output: ${err.message}`)
    return out
  }
}

/**
 * Run the gate. Returns { code, message }; the CLI wrapper exits with code.
 * `runAudit` is injectable so tests can drive this without network access.
 */
export function main(runAudit = runAuditJson) {
  let audit
  try {
    audit = JSON.parse(runAudit())
  } catch (err) {
    return {
      code: 2,
      message:
        `audit-gate: could not obtain npm audit JSON (${err.message}). ` +
        'The registry audit endpoint is unreachable from some networks; CI is the source of truth.',
    }
  }
  const ids = ghsaIdsFromAudit(audit)
  const bad = findUnallowlisted(ids)
  if (bad.length > 0) {
    const where = packagesForAdvisories(audit, bad)
    const lines = bad.map((id) => {
      const pkgs = where.get(id) ?? []
      const detail = pkgs.length > 0 ? ` — ${pkgs.join(', ')}` : ''
      return `  ${id}${detail}`
    })
    return {
      code: 1,
      message:
        `audit-gate: FAIL — ${bad.length} unallowlisted ${bad.length === 1 ? 'advisory' : 'advisories'}:\n` +
        lines.join('\n') +
        '\nTriage each one: upgrade to the fixed version, or document it in ALLOWLIST with a reason.',
    }
  }
  return {
    code: 0,
    message: `audit-gate: OK — ${ids.size} ${ids.size === 1 ? 'advisory' : 'advisories'} reported, all allowlisted.`,
  }
}

const invokedAsCli = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href
/* v8 ignore next 3 — CLI entrypoint only; unit tests import this module instead. */
if (invokedAsCli) {
  const result = main()
  console.error(result.message)
  process.exit(result.code)
}
