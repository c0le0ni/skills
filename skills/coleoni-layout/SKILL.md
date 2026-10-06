---
name: coleoni-layout
description: >
  Audits and fixes the layout of a page: edges that almost line up but don't
  (off by 1 to 6px), the rhythm of spacing between sections, headings that sit
  closer to the block above than to their own content, and how the page holds
  at 390, 768 and 1280px. Draws the edges and gaps over the real page and
  moves the layout onto one container and one spacing scale. Use when the
  user asks about "alignment", "layout", "spacing between sections", "grid",
  "it looks crooked", "responsive", "alinhamento", or runs /coleoni-layout.
argument-hint: "[url or file] [part of the page] [--fix]"
---

# Coleoni · Layout

User request: $ARGUMENTS

(If the agent does not substitute `$ARGUMENTS`, the request is the user's own message.)

Pages built section by section drift: one section padded 30px, the next
32px, the one after 34px. Nobody can see the numbers; everyone feels the page
is crooked. You measure where every block starts, draw it, and put the page
back on one grid.

Reply to the user in the language they wrote in.

The engine is `scripts/layout.mjs` (Node + `playwright-core` driving the
installed Chrome or Edge, no browser download). Part of the family with
`/coleoni-polish`, `/coleoni-type` and `/coleoni-color`; `/coleoni-interface`
runs them together.

## 1. Run

```bash
cd SKILL_DIR && npm install          # first time only
node SKILL_DIR/scripts/layout.mjs <url|file|folder> --out layout-report [--lang pt]
```

`SKILL_DIR` is the folder that holds this `SKILL.md`.

| Check | What counts as a problem |
| --- | --- |
| Alignment | a left edge 1 to 6px away from a more used one |
| Rhythm | gaps between sections with close but different values |
| Grouping | a heading with as much space below as above (≥ 75%) |
| Widths | sideways scroll at 390 or 768px |

Output: `report.html`, `report.png` (the page with every left edge drawn,
near misses in red and section gaps in blue; the page at 390 and 768px),
`report.json`, `report.md`.

## 2. Read it

Open `report.png` with your image-reading tool. The overlay shows the grid
the page actually has. Decide which edges are the system (usually the most
used two or three: page margin, card padding, an inner column) and which are
accidents. Look for what a measurement can't judge: unequal columns that
should be equal, a section wider than the others for no reason, content
that ignores the grid of the cards next to it.

Room for translation and long content belongs to `/coleoni-break`; spacing
values inside components belong to `/coleoni-polish`.

## 3. Fix (only when the user asks, or with `--fix`)

1. **One container.** `max-width` + `margin-inline: auto` + one
   `padding-inline` token on a wrapper every section shares, instead of
   padding per section.
2. **One rhythm.** A section spacing token (and a larger one for real
   breaks in subject); headings with about twice the space above as below.
3. **Fluid grids.** `repeat(auto-fill, minmax(min(100%, 16rem), 1fr))`,
   `min-width: 0` on flex children, `overflow-x: auto` wrappers for tables.

Write it the way the project writes styles. Run the script again and show
both overlays.

## Deliver

The edges that should be the system, the near misses, the rhythm proposed,
and the path to `report.html`.

---

Made by [Coleoni](https://coleoni.com) · [skills.coleoni.com](https://skills.coleoni.com/coleoni-layout/)
