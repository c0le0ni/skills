# Polish: skills.coleoni.com/coleoni-polish

- **[Fix] 5 different corner radii**
  In use: 3px ×3, 5px ×7, 8px ×15, 10px ×1, 12px ×9. Close values (10, 12, 16) read as mistakes, not choices.
  Fix: A scale of 3 or 4 tokens (--r-sm, --r-md, --r-lg, --r-pill), and each component picks one.
- **[Fix] 14 spacings off the 4px grid**
  Values like 14px ×80, 57px ×20, 18px ×18, 115.2px ×14, 19.5px ×5, 7px ×4, 51.2px ×4, 50px ×2. Almost equal to their neighbors on the scale, they create 1 to 3px misalignments.
  Fix: A spacing scale in multiples of 4 (4 8 12 16 24 32 48 64) and tokens for it.
