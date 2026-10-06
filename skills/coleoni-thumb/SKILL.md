---
name: coleoni-thumb
description: >
  Gera thumbnails e mockups de portfólio de QUALQUER site a partir de capturas
  reais (não é imagem gerada por IA). Monta as telas em molduras de desktop,
  página longa, janela de navegador e celular, com vários layouts e fundos
  (automático, escuro, cor da marca, mesh, pontilhado, desfocado ou cor hex),
  em 1× e 2×. Use quando o usuário pedir "thumbnail", "capa do projeto",
  "mockup do site", "imagem pro portfólio/Behance/Dribbble/Instagram", ou rodar
  /coleoni-thumb.
argument-hint: "<url> [layouts] [fundos] [tamanho] [o que mostrar/esconder]"
---

# Coleoni · Thumbnails de portfólio

Pedido do usuário: $ARGUMENTS

(Se o agente não substituir `$ARGUMENTS`, o pedido é a própria mensagem do usuário.)

Você transforma um site em artes de apresentação no estilo "mockup de estúdio":
telas reais do site, em molduras limpas, sobre um fundo que conversa com a
paleta dele. Tudo sai de capturas reais, então a arte mostra exatamente o que
foi entregue, sem custo de API de imagem.

O motor é `scripts/thumb.mjs` (Node + `playwright-core` com o Chrome instalado,
sem baixar navegador). Ele captura uma vez e recompõe quantas variações quiser.

## 1. Entender o pedido

- **URL.**
  - Se o usuário não passou uma, use o site do projeto atual.
  - Site local: confirme que o servidor está de pé. Prefira o build de produção, porque o dev pode ter o indicador do Next na tela; suba o servidor do projeto se precisar.
  - URL pública: use direto.
- **Variações.** Layouts e fundos que ele quer.
  - Se não disser, rode o conjunto padrão de 4 artes: `split:auto`, `devices:dark`, `wall:mesh` e `phones:brand`.
  - Se pedir "várias opções", gere 6–8 pares variados.
- **Tamanho.**
  - Padrão `1536x1024` (3:2), com o 2× junto.
  - Comuns: `1920x1080` (16:9), `1600x1200` (4:3), `1080x1350` (feed 4:5) e `1200x1200` (quadrado).
  - Telas em pé ou quadradas usam um arranjo vertical automático.
- **O que esconder.** Banners de cookies, chat, botões flutuantes e popups: use `--hide`. **Nunca clique em "aceitar" cookies** só para limpar a tela; esconda com CSS.
- **Pasta de saída.** Dentro do projeto atual (ex.: `docs/portfolio/`) ou onde o usuário pedir. Não commitar sem ele pedir.

## 2. Preparar (uma vez por máquina)

`SKILL_DIR` é a pasta onde está este `SKILL.md`. Ela muda conforme o agente e o
escopo da instalação (`~/.claude/skills/coleoni-thumb`, `~/.codex/skills/coleoni-thumb`,
`.agents/skills/coleoni-thumb` no projeto…). Use o caminho real de onde você leu
este arquivo.

Se `SKILL_DIR/node_modules/playwright-core` não existir, instale:

```bash
cd SKILL_DIR && npm install
```

Só instala `playwright-core`; usa o Chrome (ou o Edge) do sistema. Se não achar o navegador, defina `CHROME_PATH`.

## 3. Rodar

```bash
node SKILL_DIR/scripts/thumb.mjs <url> --out <pasta> [opções]
```

O script imprime:
- a paleta detectada: fundo, texto e destaque;
- a **lista de seções** do desktop, com índice, posição e altura.

Use essa lista para escolher `--column`.

### Opções

| Opção | Para quê |
| --- | --- |
| `--set split:auto,phones:#1f2a24` | Pares exatos layout:fundo (recomendado) |
| `--layouts a,b` + `--bg x,y` | Combinação de todos os layouts com todos os fundos |
| `--frame plain\|browser` | Moldura das telas de desktop (padrão: `plain` no split e no wall, `browser` no devices e no focus) |
| `--size 1536x1024` | Tamanho em 1× (o 2× sai junto) |
| `--name meu-projeto` | Prefixo dos arquivos (padrão: título do site) |
| `--label site.com.br` | Texto da barra do navegador (padrão: o host; vazio em localhost) |
| `--column 1,2,5,9` | Seções que entram na página longa, na parede e no tilt (padrão: todas depois da primeira) |
| `--phone-at 0,0.3,0.62` | Trechos da página nos três celulares, em fração da altura; encaixa no início da seção mais próxima |
| `--hide ".cookie,#chat"` | Esconde elementos nas capturas |
| `--force-visible` | Força visíveis elementos de animação de entrada (AOS, `.reveal`, `.wow`…) que ficaram transparentes |
| `--motion` | Captura sem movimento reduzido. O padrão é reduzido, que evita pegar animação pela metade |
| `--wait 800` | Espera extra antes de capturar (sites lentos) |
| `--desktop 1440x900` `--mobile 390x844` | Viewports |
| `--reuse` | Reaproveita as capturas e só recompõe. Use para testar fundos e layouts rápido |

### Layouts

- `split`: tela grande do desktop (topo da página) e uma coluna com a página longa ao lado. É o clássico de portfólio.
- `devices`: janela de navegador com um celular sobreposto no canto.
- `wall`: três colunas da página inteira, desencontradas, saindo pelas bordas.
- `phones`: trio de celulares (abertura no centro, dois trechos nas laterais).
- `focus`: uma janela de navegador grande e centralizada.
- `tilt`: páginas inclinadas em perspectiva (isométrico).

### Fundos

- `auto`: o fundo do site, um pouco mais escuro, com luz suave. É o mais elegante.
- `dark`: grafite levemente puxado para a cor da marca.
- `brand`: a cor de destaque do site.
- `mesh`: manchas suaves com a cor da marca.
- `grid`: pontilhado discreto sobre o tom do site.
- `blur`: a primeira tela do site desfocada e escurecida.
- `#rrggbb`: cor livre.

## 4. Conferir antes de entregar (obrigatório)

Abra **cada** JPG gerado (com a ferramenta de ler imagem do seu agente) e procure:

- **Banner, chat ou botão flutuante por cima.** Use `--hide` e rode de novo.
- **Seção em branco ou meio transparente** (animação de entrada que não disparou). Use `--force-visible` ou `--wait`.
- **Hero capturada no meio de uma animação.** O padrão já é movimento reduzido; se o site só mostra conteúdo com animação, use `--motion` e `--wait`.
- **Corte feio na coluna, na parede ou no tilt** (seção cortada no meio de cards, seção sem graça como uma lista de filtros). Escolha seções melhores com `--column`, olhando a lista impressa.
- **Celulares mostrando trechos pobres.** Ajuste `--phone-at`.
- **Barra do navegador vazia ou errada.** Use `--label`.
- **Fundo brigando com o site.** Tente outro fundo com `--reuse`, que leva segundos.

Corrija e recomponha com `--reuse` sempre que a captura em si estiver boa.

## 5. Entregar

- Mostre as artes ao usuário (a versão 1×; diga que o @2x está na mesma pasta). Se o agente tiver uma ferramenta de enviar arquivo, use-a.
- Liste os arquivos com caminho clicável.
- Em uma linha, sugira uma ou duas variações que valham a pena, com o comando pronto (ex.: o mesmo layout num fundo escuro, ou um momento específico do site).
- Não commitar as imagens sem o usuário pedir.

## Notas

- As capturas ficam em `<out>/.capture/<host>/`: PNGs em 2× e o `meta.json` com paleta e seções. A pasta pode ser apagada depois.
- Sites com cena ou animação presa à rolagem: o modo reduzido costuma mostrar a versão estática, que é a melhor para thumbnail. Para mostrar um momento específico da cena, capture à parte e componha com o HTML gerado em `.capture/` como base.
- Páginas muito longas: cada seção é limitada a 4000px de captura.

---

Feita pela [Coleoni](https://coleoni.com) · [skills.coleoni.com](https://skills.coleoni.com/coleoni-thumb/)
