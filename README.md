<p align="center">
  <a href="https://skills.coleoni.com">
    <img src=".github/assets/banner.jpg" alt="Coleoni Skills: skills para Claude Code, Codex e outros agentes" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://skills.coleoni.com"><b>skills.coleoni.com</b></a>
  &nbsp;·&nbsp;
  <a href="https://coleoni.com">coleoni.com</a>
  &nbsp;·&nbsp;
  <a href="#licença">Licença MIT</a>
</p>

<br>

As skills que eu uso no meu fluxo pra entregar projeto, abertas e de graça.
Funcionam no **Claude Code**, no **Codex**, no **Cursor**, no **Gemini CLI** e
nos outros agentes que leem `SKILL.md`.

## Instalar

```bash
npx skills add c0le0ni/skills
```

O instalador mostra as skills deste repositório e pergunta em quais agentes
instalar. Pra pular as perguntas:

| Quero | Comando |
| --- | --- |
| Só uma skill | `npx skills add c0le0ni/skills --skill coleoni-thumb` |
| Pro usuário todo, não só o projeto | `npx skills add c0le0ni/skills -g` |
| Só no Claude Code | `npx skills add c0le0ni/skills -a claude-code` |
| Só no Codex | `npx skills add c0le0ni/skills -a codex` |
| Ver a lista sem instalar | `npx skills add c0le0ni/skills --list` |

Usa o [`skills`](https://github.com/vercel-labs/skills), o instalador aberto
de skills da Vercel. Precisa do Node.js 18 ou mais novo.

## Skills

| Skill | O que faz |
| --- | --- |
| [`/coleoni-thumb`](#coleoni-thumb) | Thumbnails e mockups de portfólio com as telas reais do projeto |

<br>

### `/coleoni-thumb`

<a href="https://skills.coleoni.com/coleoni-thumb/">
  <img src=".github/assets/coleoni-thumb-phones-brand.jpg" alt="Arte gerada pela coleoni-thumb: três celulares com o Coleoni OS sobre o fundo da marca" width="100%">
</a>

A skill abre o site, captura desktop e celular e monta as telas em molduras de
navegador e celular, sobre um fundo tirado da paleta do próprio site. Nada é
gerado por IA: a arte mostra exatamente o que foi entregue.

- **6 layouts:** `split`, `devices`, `wall`, `phones`, `focus` e `tilt`.
- **7 fundos:** `auto`, `dark`, `brand`, `mesh`, `grid`, `blur` ou qualquer cor hex.
- **JPG em 1× e 2×**, no tamanho que você pedir: 3:2, 16:9, 4:3, feed 4:5 ou quadrado.
- **Sem download de navegador.** Usa o Chrome ou o Edge da máquina. O único
  pacote é o `playwright-core`, que o agente instala no primeiro uso.

```text
/coleoni-thumb https://seusite.com.br
/coleoni-thumb https://seusite.com.br phones e devices no fundo da marca, 1080x1350
```

<table>
  <tr>
    <td width="50%"><img src=".github/assets/coleoni-thumb-split-auto.jpg" alt="Layout split"><br><sub><code>split</code> · <code>auto</code></sub></td>
    <td width="50%"><img src=".github/assets/coleoni-thumb-devices-dark.jpg" alt="Layout devices"><br><sub><code>devices</code> · <code>dark</code></sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/coleoni-thumb-wall-mesh.jpg" alt="Layout wall"><br><sub><code>wall</code> · <code>mesh</code></sub></td>
    <td width="50%"><img src=".github/assets/coleoni-thumb-tilt-dark.jpg" alt="Layout tilt"><br><sub><code>tilt</code> · <code>dark</code></sub></td>
  </tr>
</table>

Todas as artes desta página foram geradas pela própria skill.
[Ver a página completa da skill](https://skills.coleoni.com/coleoni-thumb/).

## Feito por

<a href="https://coleoni.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/coleoni-lockup-dark.svg">
    <img src=".github/assets/coleoni-lockup-light.svg" alt="Coleoni" height="36">
  </picture>
</a>

**Michel Coleoni**, desenvolvedor que constrói sites sob medida. Estas skills
saem dos projetos da Coleoni e ficam abertas pra quem quiser usar.

- Site: [coleoni.com](https://coleoni.com)
- Skills: [skills.coleoni.com](https://skills.coleoni.com)

Se uma skill te ajudou, uma estrela aqui no repositório ajuda a divulgar.

## Licença

[MIT](LICENSE). Use, mude e redistribua à vontade, mantendo o aviso de
copyright com o nome da Coleoni.
