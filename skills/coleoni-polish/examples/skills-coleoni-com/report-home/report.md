# Polish: skills.coleoni.com

- **[Fix] 11 spacings off the 4px grid**
  Values like 43.5px ×64, 57px ×10, 18px ×3, 115.2px ×3, 7px ×2, 140.8px ×1, 89.6px ×1, 50px ×1. Almost equal to their neighbors on the scale, they create 1 to 3px misalignments.
  Fix: A spacing scale in multiples of 4 (4 8 12 16 24 32 48 64) and tokens for it.
