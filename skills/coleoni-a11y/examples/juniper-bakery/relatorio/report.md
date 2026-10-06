# Auditoria de acessibilidade: juniperbakery.com

WCAG 2.2 AA · eMAG 3.1. 1 páginas. 5 impedem o uso, 3 a corrigir, 2 vale olhar, 26 regras ok.

## [Impede o uso] Os elementos devem ter contraste de cor suficiente

Certifique-se de que o contraste entre as cores de primeiro plano e de fundo atenda aos limites de relação de contraste WCAG 2 AA

- WCAG: 1.4.3 Contraste (mínimo) (AA)
- eMAG: 4.1 Oferecer contraste mínimo entre plano de fundo e primeiro plano
- 21 elementos em /
  - `header > .btn[href$="#menu"]` <a class="btn" href="#menu">Order for pickup</a>
  - `.eyebrow` <span class="eyebrow">Alberta St, Portland · open 7 to 3</span>
  - `.actions > .btn[href$="#menu"]` <a class="btn" href="#menu">See today’s menu</a>
  - `small` <small>Tuesday · 6 left</small>
- Como corrigir: O elemento tem contraste insuficiente no valor de 3.93 (cor do primeiro plano: #ffffff, cor de fundo: #c8643b, tamanho da fonte: 11.3pt (15px), normal/negrito: normal). Contraste esperado no valor de 4.5:1 (https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=axeAPI&lang=pt-BR)

## [Impede o uso] O foco não aparece

Quem navega pelo teclado chega nesses elementos e nada na tela mostra onde está.

- WCAG: 2.4.7 Foco visível (AA)
- eMAG: 4.4 Possibilitar que o elemento com foco seja visualmente evidente
- 11 elementos em /
  - `a ./` Juniper Bakery
  - `button`
  - `a #menu` Today
  - `a #cakes` Cakes
- Como corrigir: Adicione um estilo :focus-visible (contorno ou anel) com contraste de pelo menos 3:1 com o fundo.

## [Impede o uso] Botões devem ter texto discernível

Certifique-se de que botões tenham texto discernível

- WCAG: 4.1.2 Nome, função, valor (A)
- eMAG: 2.2 Garantir que os objetos programáveis sejam acessíveis
- 1 elementos em /
  - `.icon-btn` <button class="icon-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F4A3A" stroke-width="2"><
- Como corrigir: O elemento não tem texto interno que seja visível aos leitores de tela   O atributo 'aria-label' não existe ou está vazio (https://dequeuniversity.com/rules/axe/4.14/button-name?application=axeAPI&lang=pt-BR)

## [Impede o uso] Imagens devem ter texto alternativo

Certifique-se de que elementos <img> tenham texto alternativo ou um 'role' igual a 'none' ou 'presentation'

- WCAG: 1.1.1 Conteúdo não textual (A)
- eMAG: 3.6 Fornecer alternativa em texto para as imagens do sítio
- 1 elementos em /
  - `img` <img src="favicon.svg" width="120" height="120" style="margin-bottom:18px">
- Como corrigir: O elemento não tem um atributo 'alt'   O atributo 'aria-label' não existe ou está vazio (https://dequeuniversity.com/rules/axe/4.14/image-alt?application=axeAPI&lang=pt-BR)

## [Impede o uso] O conteúdo não se ajusta em 320px

Com 320 pixels CSS de largura (zoom de 400% num notebook) a página rola pro lado.

- WCAG: 1.4.10 Refluxo (AA)
- eMAG: 4.3 Permitir redimensionamento sem perda de funcionalidade
- 1 elementos em /
  - `div · +220px`
- Como corrigir: Deixe o elemento quebrar ou encolher: max-width: 100%, grids flexíveis, overflow-x: auto em tabelas e código.

## [A corrigir] Todo o conteúdo da página deve estar contido em regiões (landmarks)

Certifique-se de todo o conteúdo da página esteja contido em regiões (landmarks)

- WCAG: best practice
- eMAG: 1.8 Dividir as áreas de informação
- 10 elementos em /
  - `.eyebrow` <span class="eyebrow">Alberta St, Portland · open 7 to 3</span>
  - `h1` <h1>Bread out of the oven at 7. <em>Cakes by order.</em></h1>
  - `.lead` <p class="lead">Order today’s bread before it sells out, or a cake for the weekend with 48 hours’ notice. No account, pa
  - `.promo` <div class="promo">Free cardamom bun with every cake ordered this week. Details <a href="#cakes" style="color:#F6F0E6">h
- Como corrigir: Algum conteúdo da página não está contido em regiões (landmarks) (https://dequeuniversity.com/rules/axe/4.14/region?application=axeAPI&lang=pt-BR)

## [A corrigir] Níveis dos títulos devem aumentar de um em um

Certifique-se de que a hierarquia dos níveis de títulos seja semanticamente correta

- WCAG: best practice
- eMAG: 1.3 Utilizar corretamente os níveis de cabeçalho
- 1 elementos em /
  - `h4` <h4>Order before it sells out</h4>
- Como corrigir: Hierarquia de títulos inválida (https://dequeuniversity.com/rules/axe/4.14/heading-order?application=axeAPI&lang=pt-BR)

## [A corrigir] O documento deve ter uma região 'main'

Certifique-se de que o documento tenha apenas uma região 'main' e que cada 'iframe' na página tenha no náximo uma região 'main'

- WCAG: best practice
- eMAG: 1.8 Dividir as áreas de informação
- 1 elementos em /
  - `html` <html lang="en">
- Como corrigir: O documento não tem uma região 'main' (https://dequeuniversity.com/rules/axe/4.14/landmark-one-main?application=axeAPI&lang=pt-BR)

## [Vale olhar] Sem link de pular conteúdo

A primeira parada do Tab não é um link pro conteúdo principal, então quem usa teclado passa pelo menu inteiro em toda página.

- WCAG: 2.4.1 Ignorar blocos (A)
- eMAG: 1.5 Fornecer âncoras para ir direto a um bloco de conteúdo
- 1 elementos em /
  - `a ./ “Juniper Bakery”`
- Como corrigir: Adicione “Ir para o conteúdo” como primeiro elemento focável, apontando pra <main id="conteudo">. O eMAG pede isso na recomendação 1.5.

## [Vale olhar] A animação ignora o movimento reduzido

Com “reduzir movimento” ligado no sistema, essas animações continuam. Elas podem causar enjoo em quem tem distúrbio vestibular.

- WCAG: 2.3.3 Animação a partir de interações (AAA), 2.2.2 Pausar, parar, ocultar (A)
- eMAG: 5.5 Fornecer controle de animação, 2.7 Assegurar o controle do usuário sobre as alterações temporais do conteúdo
- 1 elementos em /
  - `span.badge`
- Como corrigir: Coloque a animação dentro de @media (prefers-reduced-motion: no-preference), ou pare ela no modo reduce.

## Ainda conferir à mão

- [ ] Ouça a página com leitor de tela (NVDA, VoiceOver, TalkBack): a ordem faz sentido?
- [ ] O texto alternativo diz o que a imagem significa ali, não como ela é.
- [ ] Vídeos têm legenda; áudios têm transcrição.
- [ ] Erros de formulário dizem o que deu errado e como corrigir, do lado do campo.
- [ ] Zoom em 200%: nada cortado, nada sobreposto.
- [ ] Tudo o que funciona com o mouse funciona com o teclado.

Testes automáticos acham parte dos problemas. O resto precisa da conferência manual acima. A Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63) exige acessibilidade nos sites de empresas com sede ou representação no Brasil e de órgãos públicos.