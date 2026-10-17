# PLAN.md — Issue #375: Add more emojis to keyword images

## What

Expand `KEYWORD_EMOJI_GROUPS` in `src/components/KeywordImagePicker.tsx` from
30 to 66 curated emojis: grow each existing group (Animals, Food, Things,
Weather and nature) to 12 entries and add three new groups (Play, Home,
Clothes) with 6 entries each. Existing entries and group order unchanged, so
stored teacher selections keep working (lookup is by emoji value, not index).

## Research (Donray's comment: "search online to help curate more emojis")

Checked Dolch sight-word noun lists and classroom word-wall lists for
K-3 concrete nouns. Curation rules applied:

- Monosyllabic concrete nouns preferred: keyword images anchor a phonics
  pattern, so the name must be instantly sayable (bee, duck, drum, chair).
- Classroom-safe, no people/gender/skin-tone variants (accounts are
  educators 18+; kids do not create accounts; keep the picker neutral).
- Single-codepoint emojis that render consistently; no ZWJ sequences.
- Never remove existing entries (teachers may already use them).
- Do not promote 🦄 into the curated set: tests use it as the canonical
  custom emoji.

## Design

One reasonable approach: extend the existing groups + add new category
groups. Picked because teachers already know the four existing groups;
new categories (Play, Home, Clothes) match how K-3 vocab is naturally
segmented on word walls, and 6 entries each keeps the dialog scannable.

## Files

- `src/components/KeywordImagePicker.tsx` — data only.
- `PLAN.md` — this file (replaced per repo convention).

## Test plan

- Existing `KeywordImagePicker.test.tsx` covers the grid (no count
  assertions; verified no other file imports KEYWORD_EMOJI_GROUPS).
- Run `npm run format`, `npm run lint`, `npm run typecheck`, and the full
  unit suite with coverage thresholds.
- No e2e: data-only change to an exported constant; unit suite covers the
  picker component that consumes it.

## Additions

- Animals: 🐔 Chicken, 🦆 Duck
- Food: 🍇 Grapes, 🍓 Strawberry, 🍑 Peach, 🥛 Milk, 🍳 Egg, 🧀 Cheese
- Things: 🚲 Bike, 🪁 Kite, 🛹 Skateboard, 🧸 Teddy bear
- Weather and nature: 🌧️ Rain, ⛄ Snowman, 🌊 Wave, 🌻 Sunflower, 🌵 Cactus, 🍁 Leaf
- Play (new): ⚾ Baseball, 🏈 Football, 🎾 Tennis, 🥁 Drum, 🎸 Guitar, 🎨 Paint
- Home (new): 🛏️ Bed, 🪑 Chair, 🚪 Door, 🔔 Bell, 🛋️ Couch, 🛁 Bath
- Clothes (new): 👕 Shirt, 👖 Pants, 👟 Shoes, 🧢 Cap, 🧥 Coat, 🕶️ Sunglasses
