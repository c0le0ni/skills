# Example: the open source cards on coleoni.com

I ran `/coleoni-variants` on my own site, [coleoni.com](https://coleoni.com), on a
local copy, on 13/10/2026. The component is `#open-source`: the three cards
(Skills, Blob, Loaders) where the hero meets the next section.

- `variants.json`: the brief and the three directions the skill wrote (Index,
  Spotlight, Shelf), each with its note and CSS in the page's own tokens.
- `board/`: the board it generated. Open `board/board.html`: the current cards
  and the three directions on desktop and on a 390px phone, plus each one in the
  page. `board/variants.md` is the same in text.
- `index-built.patch`: Index built into the source (`globals.css` and
  `ProductCards.tsx`), no injected CSS left.
- `built.json` and `built/`: the same board run again after the build, to check
  the built version against the injected one.

The "text cut off" flag on every column, the current one included, is a false
positive of the check on this page, not a problem in the variations.
