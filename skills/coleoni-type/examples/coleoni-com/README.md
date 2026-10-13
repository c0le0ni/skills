# Example: the type of coleoni.com

I ran `/coleoni-type` on my own site, [coleoni.com](https://coleoni.com), live,
on 13/10/2026, with the report in Portuguese (`--lang pt`).

- `report-pt/`: the Portuguese page, coleoni.com/pt.
- `report-en/`: the English page, coleoni.com, same report language.

Open each `report.html`; `report.md` and `report.json` hold the same findings.

What it found, the same on both pages: the fonts are fine (Geist loads as one
variable file, 8 weights in use, no faked bold), but there are 23 font sizes,
14 pairs of them almost equal, and paragraphs about 86 characters per line.
The fix it suggests is a scale of 5 to 7 steps in rem tokens and
`max-width: 34em` on paragraphs. Nothing is applied yet: these are the reports
as they came out.
