# Color: rough

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
- **[Fix] 3 groups of almost identical colors**
  #2F4A3A ×7 #2E4B3B ×1 #304A39 ×1 · #8A8F86 ×5 #8B8F87 ×1 · #C8643B ×4 #C9663C ×1 · Nobody sees the difference; the code keeps both forever.
  Fix: Keep the most used one in each group and make it a token.
- **[Fix] 34 colors written straight into the CSS**
  34 of 34 color declarations use raw values instead of variables (0 use tokens). Changing the brand becomes a treasure hunt.
  Fix: Semantic tokens (--bg, --text, --accent…) on top of a scale; see palette.css.
- **[Worth a look] No dark mode**
  No prefers-color-scheme: dark rule. Not required; if you want one, the tokens below include the dark version.
  Fix: Tokens with light and dark values, switched by @media (prefers-color-scheme: dark).
