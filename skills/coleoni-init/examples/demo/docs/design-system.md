# Design system

Source: the approved screens in `mockups/` (idle board, a run, run over, the
tree, "how it works", phone). Colors were read from the screens' pixels. The screens show items
the scope moves to the roadmap (daily challenge, days in a row, account cloud):
their look is reference, not scope.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0a0a0a` | Page background, behind the board |
| `--surface` | `#111111` | Icon buttons, the "how it works" panels |
| `--surface-raised` | `#151515` | Sheets and dialogs |
| `--text` | `#f5f5f5` | Main text, the streak number |
| `--text-muted` | `#a0a0a0` | Secondary text, icons |
| `--text-faint` | `#8a8a8a` | Labels, the hint, the multiplier at rest |
| `--line` | `#ffffff1a` | Borders of buttons and panels |
| `--line-strong` | `#ffffff2e` | Sheets, the daily challenge box |
| `--cell-1` | `#2a2a2d` | Board cell, resting |
| `--cell-2` | `#505154` | Board cell, level 2 |
| `--cell-3` | `#75767a` | Board cell, level 3 |
| `--cell-4` | `#9b9ca0` | Board cell, level 4 |
| `--cell-5` | `#d3d4d8` | Board cell, brightest |
| `--accent` | `#aefa0e` | The pixel, the multiplier, a new record. One green thing at a time |

## Type

| Role | Family | Size / line height |
| --- | --- | --- |
| Streak number | Geist, weight 510 | 121px / 0.9, tracking -0.065em |
| Section title | Geist, weight 510 | 90px / 1.02, tracking -0.062em |
| Pixels (wallet) | Geist, weight 510 | 66px / 0.95 |
| Body | Geist, weight 400 | 16px / 1.45 |
| Multiplier | Geist Mono, weight 500 | 24px / 1.45 |
| Label and hint | Geist Mono, uppercase | 11px / 1.25, tracking 0.08em |

## Spacing and shape

- Page gutter: 4.45vw, from 16px to 64px. Spacing base: 4px (to confirm).
- Radius: 2px (energy bar), 9.6px (icon buttons), 16px (sheets); the daily challenge box and the light button are square.
- Board: 33 by 33 rounded cells, 728px on a wide screen (cell radius to confirm).

## Rules

- Components use tokens only; no raw hex in components.
- Borders, not shadows. No gradients.
- The green marks what the player does or earns: the pixel, the multiplier, a record behind a green block. Never a background or a button color.
- Numbers are the interface: big Geist for counts, small uppercase mono for what they mean.
