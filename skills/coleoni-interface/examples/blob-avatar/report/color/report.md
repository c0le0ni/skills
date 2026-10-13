# Color: blob.coleoni.com

- **[Corrigir primeiro] Contraste 3.04:1 em “Made by
Coleoni
(opens in a ”**
  #898C92 sobre #F2F3F5, 11px. Precisa de 4.5:1 (WCAG AA).
  Como corrigir: A mesma cor um pouco mais escura: #6C6F74 (4.57:1).
- **[Corrigir] 2 grupos de cores quase iguais**
  #FFFFFF ×18 #F9FAFB ×4 #FDFDFE ×2 · #EDEEF0 ×2 #F2F3F5 ×1 · Ninguém vê a diferença; o código mantém as duas pra sempre.
  Como corrigir: Fique com a mais usada de cada grupo e transforme em token.
- **[Vale olhar] 7 cores com saturação**
  Muitas cores fortes competem pela atenção; o destaque deixa de destacar.
  Como corrigir: Uma cor de destaque, uma de apoio, e o resto neutro.
- **[Vale olhar] Sem modo escuro**
  Nenhuma regra prefers-color-scheme: dark. Não é obrigatório; se for fazer, os tokens abaixo já trazem a versão escura.
  Como corrigir: Tokens com valores claros e escuros, trocados por @media (prefers-color-scheme: dark).
