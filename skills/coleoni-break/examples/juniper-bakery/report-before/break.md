# Break test: before · `#menu`

9 / 14 scenarios break.

- **Text 3× longer**: breaks. text cut off: h2.name (+7); texts on top of each other: span.price × h2.name (+2)
- **A word that won't wrap**: breaks. text cut off: h2.name (+7); texts on top of each other: span.price × h2.name (+4)
- **No text**: holds
- **Translated, 40% longer**: breaks. text cut off: h2.name (+2); texts on top of each other: span.price × h2.name (+2)
- **Huge numbers**: breaks. text cut off: p.meta; texts on top of each other: span.price × h2.name (+2)
- **Accents and emoji**: breaks. text cut off: h2.name (+7); texts on top of each other: span.price × h2.name (+2)
- **Images fail**: look
- **Only one item**: holds
- **25 items**: breaks. text cut off: h2.name (+7)
- **Right to left**: breaks. texts on top of each other: span.price × h2.name (+2)
- **320px screen**: breaks. spills out of the component: article.card, 44px (+5); page scrolls sideways, 660px
- **Text at 200%**: breaks. text ignores the font size setting (px): span.price (+14)
- **High contrast**: holds
- **Dark mode**: holds (looks exactly like the default)