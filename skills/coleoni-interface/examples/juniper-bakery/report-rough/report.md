# Interface review: rough

- **[Fix first] Looks like a button, isn't one**
  div.send looks like a button but is a div with a text cursor: it can't be focused, ignores Enter and screen readers don't announce it.
  Fix: Use &lt;button type="submit"&gt; (or &lt;a href&gt; if it navigates) with the same style.
- **[Fix first] “Inter” only shows for people who have it installed**
  The CSS asks for Inter with no @font-face. It's installed on this machine, so it looks right here; most visitors get the next font in the stack.
  Fix: Serve it (woff2 from your own domain, only the weights in use, font-display: swap) or drop it from the stack and use the system font on purpose.
- **[Fix first] Contrast 2.12:1 on “With cream cheese and toaste”**
  #A9AFA4 on #FBF8F2, 14px. Needs 4.5:1 (WCAG AA).
  Fix: The same color a little darker: #6D7368 (4.63:1).
- **[Fix first] Contrast 2.91:1 on “Six flavors, three sizes and”**
  #8B8F87 on #F6F0E6, 18px. Needs 4.5:1 (WCAG AA).
  Fix: The same color a little darker: #6B6F67 (4.55:1).
- **[Fix first] Contrast 2.92:1 on “Priya S., ordered a carrot c”**
  #8A8F86 on #F6F0E6, 13.5px. Needs 4.5:1 (WCAG AA).
  Fix: The same color a little darker: #6A6F66 (4.57:1).
- **[Fix first] 5 more pairs with low contrast**
  3.12 · 3.34 · 3.40 · 3.71 · 3.93
  Fix: See the contrast table below.
- **[Fix first] Scrolls sideways at 390px**
  166px wider than the screen, starting at article.card.
  Fix: Columns with repeat(auto-fill, minmax(min(100%, 16rem), 1fr)), min-width: 0 on flex children, tables inside an overflow-x: auto wrapper.
- **[Fix] 7 different corner radii**
  In use: 4px ×3, 6px ×1, 8px ×1, 10px ×1, 12px ×4, 16px ×1, 20px ×1. Close values (10, 12, 16) read as mistakes, not choices.
  Fix: A scale of 3 or 4 tokens (--r-sm, --r-md, --r-lg, --r-pill), and each component picks one.
- **[Fix] Inner corner doesn't follow the outer one**
  An element with a 12px radius inside a 16px one, 10px from its edge. The corners aren't parallel and the inner one looks swollen.
  Fix: Inner radius = outer radius − the gap: 16 − 10 = 6px, or calc(var(--r-lg) - var(--pad)).
- **[Fix] A hard, black shadow**
  rgba(0, 0, 0, 0.5) 0px 2px 4px 0px: black at high opacity with little blur reads as a dirty edge, not depth.
  Fix: More blur, low opacity (6 to 15%) and the brand's dark color instead of black.
- **[Fix] 15 spacings off the 4px grid**
  Values like 11px ×7, 5px ×6, 26px ×5, 13px ×4, 22px ×4, 23px ×4, 14px ×3, 18px ×3. Almost equal to their neighbors on the scale, they create 1 to 3px misalignments.
  Fix: A spacing scale in multiples of 4 (4 8 12 16 24 32 48 64) and tokens for it.
- **[Fix] 3 kinds of button that don't match**
  Height, radius and font size: 46px · 6px · 15.5px, 46px · pill · 14px, 46px · 8px · 15px.
  Fix: One button component with color variants (primary, secondary) and at most two sizes, same height and radius.
- **[Fix] 2 buttons with no hover state**
  Nothing changes when the pointer is over them: they feel dead.
  Fix: A subtle :hover (background 6 to 10% darker), :active 1px down, and a 150ms transition on the properties that change.
- **[Fix] Icon off the text's center**
  The icon sits 3.2px below the center of the text line.
  Fix: Remove manual margins on the icon and align with display:inline-flex; align-items:center on the button.
- **[Fix] 13 font sizes, 7 almost equal**
  In use: 12 13 13.5 14 15 15.5 17 18 21 22 23 28 46. Pairs nobody can tell apart: 13/13.5, 13.5/14, 14/15, 15/15.5, 17/18, 21/22, 22/23.
  Fix: A scale of 5 to 7 steps with a steady ratio (1.2 to 1.33), as rem tokens: for example 13 · 15 · 17 · 21 · 28 · 44.
- **[Fix] Lines too long**
  About 130 characters per line. Past 75, reading tires and the eye misses the next line.
  Fix: max-width: 34em (about 65 characters) on paragraphs.
- **[Fix] 3 groups of almost identical colors**
  #2F4A3A ×7 #2E4B3B ×1 #304A39 ×1 · #8A8F86 ×5 #8B8F87 ×1 · #C8643B ×4 #C9663C ×1 · Nobody sees the difference; the code keeps both forever.
  Fix: Keep the most used one in each group and make it a token.
- **[Fix] 34 colors written straight into the CSS**
  34 of 34 color declarations use raw values instead of variables (0 use tokens). Changing the brand becomes a treasure hunt.
  Fix: Semantic tokens (--bg, --text, --accent…) on top of a scale; see palette.css.
- **[Fix] 2 edges that almost line up**
  30px instead of 32px (-2px, 3 blocks) · 34px instead of 30px (+4px, 3 blocks) · Nobody notices the number; everyone feels the page is crooked.
  Fix: One container (max-width + margin-inline: auto + one padding-inline token) for every section, instead of padding per section.
- **[Fix] No rhythm between sections**
  Gaps between sections: 72px → 58px → 64px → 66px. Values this close look like mistakes.
  Fix: One section spacing token (for example --s-8: 64px), and a bigger one only where the subject really changes.
- **[Fix] All page content should be contained by landmarks**
  Ensure all page content is contained by landmarks
  Fix: Some page content is not contained by landmarks
- **[Fix] Heading levels should only increase by one**
  Ensure the order of headings is semantically correct
  Fix: Heading order invalid
- **[Fix] Document should have one main landmark**
  Ensure the document has a main landmark
  Fix: Document does not have a main landmark
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
- **[Worth a look] No dark mode**
  No prefers-color-scheme: dark rule. Not required; if you want one, the tokens below include the dark version.
  Fix: Tokens with light and dark values, switched by @media (prefers-color-scheme: dark).
- **[Worth a look] No skip link**
  The first Tab stop is not a link to the main content, so keyboard users go through the whole menu on every page. WCAG 2.4.1
  Fix: Add “Skip to content” as the first focusable element, pointing to &lt;main id=&quot;content&quot;&gt;. eMAG 1.5 asks for it.
