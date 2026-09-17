# iOS design system (fork)

The web UI is designed to feel like a first-party iOS app in dark appearance:
minimal, calm, legible at arm's length at night. It is installed to the home
screen as a standalone PWA.

## Principles
- **Native, not themed.** Match Settings, Health and Home. If iOS has a pattern
  (large title, inset grouped list, segmented control, switch, sheet), use it.
- **Quiet by default.** Black background, grey grouped surfaces, one accent
  (systemBlue). Colour is reserved for meaning: temperature (cool blue ↔ warm
  orange), status (green ok, orange warning, red error).
- **No emojis. Anywhere.** Use lucide line icons.
- **No decoration.** No gradients, glows, dashed borders, coloured card borders,
  drop shadows on cards, or badge clutter.
- **Sentence case.** No uppercase/letter-spaced labels (`uppercase`,
  `tracking-wider`, `tracking-[0.1em]`). Section captions are 13pt grey.

## Tokens
The Tailwind colour scales are remapped to iOS system colours in
`app/globals.css`, so existing classes already resolve to Apple values:

| Use | Class | Value |
|---|---|---|
| Screen background | `bg-black` | #000000 |
| Grouped surface (cards, list groups) | `bg-zinc-900` | #1C1C1E |
| Raised/pressed surface, sheet fields | `bg-zinc-800` | #2C2C2E |
| Separator | `border-zinc-800` | #2C2C2E |
| Primary label | `text-white` | #FFFFFF |
| Secondary label | `text-zinc-500` | #8E8E93 |
| Tertiary label / disabled | `text-zinc-600` | #636366 |
| Accent / links / selected | `text-sky-400`, `bg-sky-500` | systemBlue #0A84FF |
| Success / on | `emerald-500` | systemGreen |
| Warning | `amber-500` | systemOrange |
| Destructive | `red-500` | systemRed |

Temperature colour is the only other hue: cool `sky-400`, neutral `zinc-400`,
warm `orange-400`.

## Type (system font, SF Pro on iPhone)
| Role | Classes |
|---|---|
| Large title | `PageHeader` (34/41 bold) |
| Title 2 (card hero numbers) | `text-[22px] font-bold` |
| Headline | `text-[17px] font-semibold` |
| Body | `text-[17px]` |
| Subhead | `text-[15px]` |
| Footnote / captions | `text-[13px] text-zinc-500` |
| Caption 2 (chart axes only) | `text-[11px] text-zinc-500` |

Nothing below 11px. Numbers that update use `ios-numeric` (tabular digits).

## Layout
- Screen side padding is 16px (the shell already applies `px-4`). Content
  stacks with `space-y-6` between groups; don't add extra horizontal padding.
- Every tab screen starts with `<PageHeader title=… />`. There is no global
  toolbar; the side switcher lives on screens that need it.
- Groups: `rounded-xl bg-zinc-900`. Rows ≥44px tall, 16px inner padding,
  hairline separators between rows (not around the group).
- Touch targets ≥44×44. Primary actions are full-width `h-[50px] rounded-xl
  bg-sky-500 text-[17px] font-semibold` buttons, or right-aligned bar buttons
  (`text-[17px] text-sky-400`) in sheets.
- Editors/forms open in a `Sheet`, not full-screen overlays.

## Primitives — `@/src/ui/ios`
- `PageHeader({ title, subtitle?, trailing? })`
- `ListSection({ header?, footer?, children })` + `ListRow({ title, subtitle?,
  value?, icon?, iconTile?, href?, onClick?, accessory?, destructive? })`
- `SegmentedControl({ options, value, onChange })`
- `Switch({ checked, onChange })` — use instead of custom toggles
- `Sheet({ open, onClose, title, leading?, trailing?, children })`

Prefer composing these. Add a new primitive only if a pattern repeats across
screens (and keep it in `src/ui/ios`).

## Charts
Thin lines (1.5–2px), no area gradients heavier than 15% opacity, grid lines
`#2C2C2E`, axis labels 11px `zinc-500`, one series colour per metric.
