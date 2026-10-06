<p align="center">
  <a href="https://skills.coleoni.com">
    <img src=".github/assets/banner.jpg" alt="Coleoni Skills: skills for Claude Code, Codex and other agents" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://skills.coleoni.com"><b>skills.coleoni.com</b></a>
  &nbsp;·&nbsp;
  <a href="https://coleoni.com">coleoni.com</a>
  &nbsp;·&nbsp;
  <a href="#license">MIT License</a>
</p>

<br>

The skills I use in my own workflow to ship projects, open and free. They work
in **Claude Code**, **Codex**, **Cursor**, **Gemini CLI** and any other agent
that reads `SKILL.md`.

## Install

```bash
npx skills add c0le0ni/skills
```

The installer lists the skills in this repository and asks which agents to add
them to. To skip the questions:

| I want | Command |
| --- | --- |
| A single skill | `npx skills add c0le0ni/skills --skill coleoni-thumb` |
| For my whole user, not just the project | `npx skills add c0le0ni/skills -g` |
| Claude Code only | `npx skills add c0le0ni/skills -a claude-code` |
| Codex only | `npx skills add c0le0ni/skills -a codex` |
| See the list without installing | `npx skills add c0le0ni/skills --list` |

It uses [`skills`](https://github.com/vercel-labs/skills), Vercel's open skills
installer. Requires Node.js 18 or newer.

## Skills

| Skill | What it does |
| --- | --- |
| [`/coleoni-thumb`](#coleoni-thumb) | Portfolio thumbnails and mockups from your project's real screens |
| [`/coleoni-briefing`](#coleoni-briefing) | Turns a client briefing into a decided scope, with a client-ready PDF |
| [`/coleoni-init`](#coleoni-init) | Sets up a new project's docs before any code, with a one-page overview |
| [`/coleoni-favicon`](#coleoni-favicon) | The complete favicon set from a logo, checked in tabs and home screens |

<br>

### `/coleoni-thumb`

<a href="https://skills.coleoni.com/coleoni-thumb/">
  <img src=".github/assets/coleoni-thumb-phones-brand.jpg" alt="Image made by coleoni-thumb: three phones showing Coleoni OS on the brand background" width="100%">
</a>

The skill opens the site, captures desktop and mobile, and sets the screens in
browser and phone frames on a background taken from the site's own palette.
Nothing is AI-generated: the image shows exactly what was shipped.

- **6 layouts:** `split`, `devices`, `wall`, `phones`, `focus` and `tilt`.
- **7 backgrounds:** `auto`, `dark`, `brand`, `mesh`, `grid`, `blur` or any hex color.
- **JPG at 1× and 2×**, in the size you ask for: 3:2, 16:9, 4:3, 4:5 feed or square.
- **No browser download.** It uses the Chrome or Edge already on the machine.
  The only package is `playwright-core`, which the agent installs on first use.

```text
/coleoni-thumb https://yoursite.com
/coleoni-thumb https://yoursite.com phones and devices on the brand background, 1080x1350
```

<table>
  <tr>
    <td width="50%"><img src=".github/assets/coleoni-thumb-split-auto.jpg" alt="split layout"><br><sub><code>split</code> · <code>auto</code></sub></td>
    <td width="50%"><img src=".github/assets/coleoni-thumb-devices-dark.jpg" alt="devices layout"><br><sub><code>devices</code> · <code>dark</code></sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/coleoni-thumb-wall-mesh.jpg" alt="wall layout"><br><sub><code>wall</code> · <code>mesh</code></sub></td>
    <td width="50%"><img src=".github/assets/coleoni-thumb-tilt-dark.jpg" alt="tilt layout"><br><sub><code>tilt</code> · <code>dark</code></sub></td>
  </tr>
</table>

Every image on this page was made by the skill itself.
[See the full skill page](https://skills.coleoni.com/coleoni-thumb/).

<br>

### `/coleoni-briefing`

<a href="https://skills.coleoni.com/coleoni-briefing/">
  <img src=".github/assets/coleoni-briefing-phones.jpg" alt="A scope document made by coleoni-briefing, shown on three phones" width="100%">
</a>

Clients describe the product they imagine. Their answers reveal a smaller,
sharper problem. This skill reads everything the client sent (form answers,
call notes, emails, chat exports) and writes a scope you can defend.

- **One pain first.** The single problem that already justifies the project,
  cited from the client's own answers.
- **What they already use stays out.** Each cut names the tool that already
  does the job, so the client sees why.
- **First release, roadmap, open questions and a deadline check**, in a
  ten-section document that reads in ten minutes.
- **Client-ready PDF.** `--pdf` renders a clean A4 document with your accent
  color and logo, using the Chrome already on the machine.

```text
/coleoni-briefing briefing/answers.csv
/coleoni-briefing client-notes.md --pdf
```

A full example, from messy briefing to scope, lives in
[`skills/coleoni-briefing/examples/juniper-bakery`](skills/coleoni-briefing/examples/juniper-bakery).

<br>

### `/coleoni-init`

<a href="https://skills.coleoni.com/coleoni-init/">
  <img src=".github/assets/coleoni-init-phones.jpg" alt="The project overview made by coleoni-init, shown on three phones" width="100%">
</a>

Before the first line of code, a project needs to say what it is, what it is
not, what was decided and what is still open. This skill reads the scope (and
the mockups or brand, when there are any) and writes that skeleton.

- **An agent guide for every agent.** `AGENTS.md` with the same eight sections
  every time, plus a one-line `CLAUDE.md` pointing to it.
- **Roadmap, status, glossary, decision records** and, when there is personal
  data, a privacy note (LGPD, GDPR).
- **Real design tokens** taken from the mockups or brand, never invented.
- **No stack, no code.** Heavy choices become pending decision records for the team.
- **One-page overview.** `--overview` turns the docs into a single HTML page with
  phases, palette, open decisions and blockers.

```text
/coleoni-init
/coleoni-init ./my-project --write --overview
```

The example continues the bakery from `/coleoni-briefing`:
[`skills/coleoni-init/examples/juniper-bakery`](skills/coleoni-init/examples/juniper-bakery).

<br>

### `/coleoni-favicon`

<a href="https://skills.coleoni.com/coleoni-favicon/">
  <img src=".github/assets/coleoni-favicon-devices.jpg" alt="The favicon preview sheet made by coleoni-favicon, in a browser and on a phone" width="100%">
</a>

One logo in, every icon out, each one checked where it actually appears.

- **The whole set:** `favicon.svg` (with dark mode), `favicon.ico` with 16, 32
  and 48 inside, PNGs, the iPhone icon, Android icons including maskable,
  `site.webmanifest` and the `<head>` tags.
- **A preview sheet** with light and dark browser tabs, iPhone and Android home
  screens and every size side by side, so a 16px problem shows before launch.
- **Crops part of a logo** (one letter, the symbol of a lockup) with `--crop`.
- **Installs it** the way the framework expects: `app/` for Next.js, the public
  folder plus `<head>` tags for the rest.

```text
/coleoni-favicon public/logo.svg
/coleoni-favicon brand/mark.svg on #0a0a0a, rounded, install it
```

## Made by

<a href="https://coleoni.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/coleoni-lockup-dark.svg">
    <img src=".github/assets/coleoni-lockup-light.svg" alt="Coleoni" height="36">
  </picture>
</a>

**Michel Coleoni**, a developer who builds custom websites. These skills come
out of Coleoni's projects and are open for anyone to use.

- Website: [coleoni.com](https://coleoni.com)
- Skills: [skills.coleoni.com](https://skills.coleoni.com)

If a skill helped you, a star on this repository helps spread the word.

## License

[MIT](LICENSE). Use it, change it and share it freely, keeping the copyright
notice with Coleoni's name.
