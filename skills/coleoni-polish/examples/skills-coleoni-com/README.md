# Example: skills.coleoni.com, measured and fixed

I ran `/coleoni-polish` on this skills site, on 13/10/2026, on the home and on
the `/coleoni-polish` page.

- `report-home/`: the home. 11 spacing values off the 4px grid.
- `report-before/`: the `/coleoni-polish` page as it was live. 5 corner radii
  (the fifth is the skip link, 10px, used once) and 14 spacing values off the
  4px grid, most of them fluid `clamp()` values.
- `fix.diff`: the fix, made in the tokens: a spacing scale in multiples of 4,
  `round()` to hold each `clamp()` on the grid, the skip link on the buttons'
  8px radius, the install box padding so it is as tall as the 44px button next
  to it. The fix is live on skills.coleoni.com.
- `report-after/`: the same page with the fix, measured on a local copy
  (hence `127.0.0.1`). 4 radii, and the only spacing left off the grid is the
  1.5em indent under `$` (19.5px and 21px), which follows the type on purpose.

Open each `report.html`; `report.md` and `report.json` hold the same findings.
