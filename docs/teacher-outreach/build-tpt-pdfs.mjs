/**
 * Build the Teachers Pay Teachers ai/ay folder PDFs from the HTML sources
 * in this folder (tpt-html/) and zip them for upload.
 *
 * Run from the repo root: `node docs/teacher-outreach/build-tpt-pdfs.mjs`
 * Requires the repo's dev dependencies (playwright-core) and the `zip`
 * command. Each PDF is US Letter; the page size and margins come from the
 * `@page` rule in each HTML file (preferCSSPageSize), and backgrounds print
 * so the color chart keeps its header colors.
 */
import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'

const execFileAsync = promisify(execFile)

const dir = dirname(fileURLToPath(import.meta.url))
const htmlDir = join(dir, 'tpt-html')

const docs = [
  { html: '01-teacher-instructions.html', pdf: '01-Teacher-Instructions-ai-ay.pdf' },
  { html: '02-printable-black-and-white.html', pdf: '02-Printable-Word-List-and-Worksheet-Black-and-White.pdf' },
  { html: '03-pattern-chart-color.html', pdf: '03-Printable-Pattern-Chart-Color.pdf' },
]
const zipName = 'ai-ay-spelling-words-tpt-folder.zip'

const browser = await chromium.launch()
try {
  for (const doc of docs) {
    const page = await browser.newPage()
    await page.goto(`file://${join(htmlDir, doc.html)}`)
    await page.pdf({
      path: join(dir, doc.pdf),
      preferCSSPageSize: true,
      printBackground: true,
    })
    await page.close()
    console.log(`Built ${doc.pdf}`)
  }
} finally {
  await browser.close()
}

const pdfPaths = docs.map((doc) => doc.pdf)
await execFileAsync('zip', ['-j', '-FS', zipName, ...pdfPaths], { cwd: dir })
console.log(`Built ${zipName}`)

// `zip -FS` writes a fresh archive, so confirm the contents match the PDFs.
const inZip = (await execFileAsync('unzip', ['-l', join(dir, zipName)])).stdout
for (const pdf of pdfPaths) {
  if (!inZip.includes(pdf)) throw new Error(`${zipName} is missing ${pdf}`)
}
console.log('Zip contents verified.')
