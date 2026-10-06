# Typography: rough

Sizes: 12, 13, 13.5, 14, 15, 15.5, 17, 18, 21, 22, 23, 28, 46

- **[Fix first] “Inter” only shows for people who have it installed**
  The CSS asks for Inter with no @font-face. It's installed on this machine, so it looks right here; most visitors get the next font in the stack.
  Fix: Serve it (woff2 from your own domain, only the weights in use, font-display: swap) or drop it from the stack and use the system font on purpose.
- **[Fix] 13 font sizes, 7 almost equal**
  In use: 12 13 13.5 14 15 15.5 17 18 21 22 23 28 46. Pairs nobody can tell apart: 13/13.5, 13.5/14, 14/15, 15/15.5, 17/18, 21/22, 22/23.
  Fix: A scale of 5 to 7 steps with a steady ratio (1.2 to 1.33), as rem tokens: for example 13 · 15 · 17 · 21 · 28 · 44.
- **[Fix] Lines too long**
  About 130 characters per line. Past 75, reading tires and the eye misses the next line.
  Fix: max-width: 34em (about 65 characters) on paragraphs.
- **[Worth a look] Justified text**
  Without hyphenation, the web opens gaps between words to fill each line.
  Fix: text-align: start.
- **[Worth a look] Capitals without tracking**
  Small capitals crowd each other without a little space between them.
  Fix: letter-spacing: .06em to .1em on uppercase labels.
- **[Worth a look] Large heading with open tracking**
  At 46px letters already look apart; positive tracking pushes them further.
  Fix: letter-spacing: -0.01em to -0.025em on large headings.
- **[Worth a look] Numbers that don't line up**
  Prices and amounts in columns with proportional digits: they don't stack under each other.
  Fix: font-variant-numeric: tabular-nums on tables, prices and totals.
