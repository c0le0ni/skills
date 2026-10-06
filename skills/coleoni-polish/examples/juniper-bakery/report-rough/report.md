# Polish: rough

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
- **[Fix first] Looks like a button, isn't one**
  div.send looks like a button but is a div with a text cursor: it can't be focused, ignores Enter and screen readers don't announce it.
  Fix: Use &lt;button type="submit"&gt; (or &lt;a href&gt; if it navigates) with the same style.
- **[Fix] 2 buttons with no hover state**
  Nothing changes when the pointer is over them: they feel dead.
  Fix: A subtle :hover (background 6 to 10% darker), :active 1px down, and a 150ms transition on the properties that change.
- **[Fix] Icon off the text's center**
  The icon sits 3.2px below the center of the text line.
  Fix: Remove manual margins on the icon and align with display:inline-flex; align-items:center on the button.
