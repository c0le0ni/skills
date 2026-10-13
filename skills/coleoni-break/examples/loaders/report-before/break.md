# Break test: arc · `[data-intro-card] > section`

3 / 14 scenarios break.

- **Text 3× longer**: breaks. spills out of the component: button.relative.flex, 74px (+2); texts on top of each other: span × button.inline-flex.shrink-0
- **A word that won't wrap**: breaks. spills out of the component: button.relative.flex, 216px (+3); texts on top of each other: span × button.inline-flex.shrink-0 (+1)
- **No text**: holds
- **Translated, 40% longer**: holds
- **Huge numbers**: holds
- **Accents and emoji**: breaks. spills out of the component: button.relative.flex, 40px (+2); texts on top of each other: span × button.inline-flex.shrink-0
- **Images fail**: look
- **Only one item**: holds
- **25 items**: holds
- **Right to left**: holds
- **320px screen**: holds
- **Text at 200%**: holds
- **High contrast**: holds
- **Dark mode**: holds