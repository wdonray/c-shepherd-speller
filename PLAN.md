# PLAN.md — Issue #377: Suggest the clearest keyword image photo size

## What

Add a short hint under the Upload photo button in the `KeywordImagePicker`
dialog, recommending the photo size that looks clearest where the image shows.

Donray: "suggest the size that works best for the location where the keyword
image will show."

## Research

- Keyword photos display at 48x48 CSS px in the pattern chart
  (`PatternChartDisplay.tsx`, `size-12`, `object-cover` square crop), the
  surface teachers project on classroom screens. Editor preview is 44x44.
- `processKeywordImage` (`src/lib/profile-image.ts`) resizes uploads to max
  128px on the long edge as a JPEG data URL (<= 10KB, DynamoDB item budget).
  Photos smaller than 128px are never upscaled in storage, so a photo below
  ~48px gets upscaled by the browser and looks blurry.
- Standard crispness rule: 2x CSS pixels for high-DPI screens = 96px. The
  128px storage cap gives 2.7x the 48px display, covering retina with margin.
- Conclusion: a square photo at least 128x128 pixels is the size that works
  best. Square also avoids surprise center-cropping in the square display.

## Design

One approach is enough: static hint copy under the upload button stating the
recommended size. No validation warning: the issue asks for a suggestion, and
the processing pipeline already guarantees max sharpness for photos at or
above the cap.

## Files

1. `src/components/KeywordImagePicker.tsx`
   - Import `KEYWORD_IMAGE_MAX_DIMENSION` from `@/lib/profile-image` and
     render a muted hint under the upload button, deriving the numbers from
     the constant so the copy stays in sync:
     "Tip: a square photo at least 128 x 128 pixels looks clearest in your
     chart."
2. `src/components/KeywordImagePicker.test.tsx`
   - Assert the hint renders with the recommended size text.

## Test plan

- `npm run format` first (prettier), then `npm run lint`, `npm run typecheck`.
- Full unit suite with coverage thresholds (repo requires 100%).
- No e2e: static copy change, no flow change.
