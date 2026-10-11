# Vendored fonts

Lexend is served from this repo instead of fetched from Google Fonts at
build time.

`next/font/google` downloads the font while `next build` runs. When that
fetch fails or Google serves a response Turbopack's font parser chokes on,
the whole production build dies with the misleading error

```
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
```

which names neither the network nor the font. That broke CI twice on a PR
whose diff was a one-line className change. Vendoring removes the
build-time network dependency entirely: the build is now deterministic.

## What is here

| File                          | Family            | Weights | Used as         |
| ----------------------------- | ----------------- | ------- | --------------- |
| `lexend-latin-variable.woff2` | Lexend (variable) | 100-900 | `--font-lexend` |

One variable file covers the whole weight range the app uses (400, 500,
600, 700, 800), so this is a single ~40 kB file rather than per-weight
statics. Only the `latin` subset is vendored, matching the `subsets:
['latin']` the app previously requested from `next/font/google`.

`src/app/layout.tsx` loads it through `next/font/local` with the same
`--font-lexend` CSS variable, so nothing else in the app changes: the rest
of the app reads the variable via Tailwind's `font-sans`.

## Licensing

Lexend is Copyright 2018 The Lexend Project Authors, licensed under the
SIL Open Font License 1.1, which permits redistribution including bundling
with software. The full license text is next to the font as `OFL.txt`; keep
it with the file if you replace or move it, and check the license of
anything you swap in.

Source: https://fonts.google.com/specimen/Lexend (served file v26,
downloaded 2026-10-11).
