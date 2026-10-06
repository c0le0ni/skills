# Layout: rough

- **[Fix] 2 edges that almost line up**
  30px instead of 32px (-2px, 3 blocks) · 34px instead of 30px (+4px, 3 blocks) · Nobody notices the number; everyone feels the page is crooked.
  Fix: One container (max-width + margin-inline: auto + one padding-inline token) for every section, instead of padding per section.
- **[Fix] No rhythm between sections**
  Gaps between sections: 72px → 58px → 64px → 66px. Values this close look like mistakes.
  Fix: One section spacing token (for example --s-8: 64px), and a bigger one only where the subject really changes.
- **[Fix first] Scrolls sideways at 390px**
  166px wider than the screen, starting at article.card.
  Fix: Columns with repeat(auto-fill, minmax(min(100%, 16rem), 1fr)), min-width: 0 on flex children, tables inside an overflow-x: auto wrapper.
