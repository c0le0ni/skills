# Auditoria de acessibilidade: blob.coleoni.com

WCAG 2.2 AA · eMAG 3.1. 1 páginas. 1 impedem o uso, 1 a corrigir, 1 vale olhar, 37 regras ok.

## [Impede o uso] Os elementos devem ter contraste de cor suficiente

Certifique-se de que o contraste entre as cores de primeiro plano e de fundo atenda aos limites de relação de contraste WCAG 2 AA

- WCAG: 1.4.3 Contraste (mínimo) (AA)
- eMAG: 4.1 Oferecer contraste mínimo entre plano de fundo e primeiro plano
- 4 elementos em /
  - `.gap-\[0\.25em\]` <span class="flex items-center gap-[0.25em]">
  - `footer > a[target="_blank"][rel="noopener noreferrer"]` <a href="https://github.com/c0le0ni/blob-avatar" target="_blank" rel="noopener noreferrer" class="inline-flex items-cent
  - `a[href$="skills.coleoni.com"]` <a href="https://skills.coleoni.com" rel="noopener" class="transition-colors hover:text-foreground">Coleoni Skills</a>
  - `a[href$="loaders.coleoni.com"]` <a href="https://loaders.coleoni.com" rel="noopener" class="transition-colors hover:text-foreground">Loaders</a>
- Como corrigir: O elemento tem contraste insuficiente no valor de 3.03 (cor do primeiro plano: #898c92, cor de fundo: #f2f3f5, tamanho da fonte: 8.3pt (11px), normal/negrito: normal). Contraste esperado no valor de 4.5:1 (https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=axeAPI&lang=pt-BR)

## [A corrigir] Todo o conteúdo da página deve estar contido em regiões (landmarks)

Certifique-se de todo o conteúdo da página esteja contido em regiões (landmarks)

- WCAG: best practice
- eMAG: 1.8 Dividir as áreas de informação
- 1 elementos em /
  - `h1` <h1 class="sr-only">Blob Avatar: make your own animated avatar</h1>
- Como corrigir: Algum conteúdo da página não está contido em regiões (landmarks) (https://dequeuniversity.com/rules/axe/4.14/region?application=axeAPI&lang=pt-BR)

## [Vale olhar] Sem link de pular conteúdo

A primeira parada do Tab não é um link pro conteúdo principal, então quem usa teclado passa pelo menu inteiro em toda página.

- WCAG: 2.4.1 Ignorar blocos (A)
- eMAG: 1.5 Fornecer âncoras para ir direto a um bloco de conteúdo
- 1 elementos em /
  - `a https://coleoni.com “Coleoni”`
- Como corrigir: Adicione “Ir para o conteúdo” como primeiro elemento focável, apontando pra <main id="conteudo">. O eMAG pede isso na recomendação 1.5.

## Ainda conferir à mão

- [ ] Ouça a página com leitor de tela (NVDA, VoiceOver, TalkBack): a ordem faz sentido?
- [ ] O texto alternativo diz o que a imagem significa ali, não como ela é.
- [ ] Vídeos têm legenda; áudios têm transcrição.
- [ ] Erros de formulário dizem o que deu errado e como corrigir, do lado do campo.
- [ ] Zoom em 200%: nada cortado, nada sobreposto.
- [ ] Tudo o que funciona com o mouse funciona com o teclado.

Testes automáticos acham parte dos problemas. O resto precisa da conferência manual acima. A Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63) exige acessibilidade nos sites de empresas com sede ou representação no Brasil e de órgãos públicos.