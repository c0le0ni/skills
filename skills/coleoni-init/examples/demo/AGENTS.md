# Streak: agent guide

> Read this first. It is the source of truth for what this project is and how
> work happens here. Details live in `docs/`. The decisions behind it are in
> [`scope-streak.md`](scope-streak.md).

## What it is

A one-page web game at streak.coleoni.com. The player follows a green pixel on a dark grid with the mouse; each catch in a row raises the streak and the multiplier, and when the energy runs out the pixels buy upgrades. It exists because "todo joguinho de navegador pede conta antes de jogar": here you open the page and you are already playing. The first release is that loop, a short "how it works" section and "Feito por Coleoni", with progress kept in the browser.

## What it is not

The scope cut these on purpose. When someone asks for one, point here.

- **A sign-up or a password system**: never on day one, and never a password. When accounts come, sign-in is a Google account ("se tiver conta, só com google, nada de senha").
- **A stats screen or admin panel**: the daily player count lives in Google Analytics, which the client already uses. The game only carries the tag.
- **A video recorder or a feed**: TikTok and the phone's screen recorder do that. The game only has to look good on video.
- **A new board design**: the dark grid and the green come from the client's Figma file.
- **A contact form or support page**: players talk to the client through Instagram direct messages.
- **Accounts, daily challenge and ranking, days in a row, achievements, share card, zen mode**: roadmap, in that order. The mockups already show some of them (the daily challenge button, days in a row, the account cloud): their look is a reference, not scope.

## Stack and setup

*Pending (ADR-0001).* Versions, the single dev port, scripts and demo access go
here once the stack is decided. Hosting is ADR-0002; where progress is saved is
ADR-0003.

## Visual identity

Dark and quiet: a grid of grey cells on near-black, and one green pixel. The green (`#aefa0e`) is the pixel and what the player earns, never decoration. Tokens in [`docs/design-system.md`](docs/design-system.md); words in [`docs/voice.md`](docs/voice.md).

## Current state

What shipped and how to test it: [`docs/STATUS.md`](docs/STATUS.md).
What comes next: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Workflow

1. Check the blockers at the top of `docs/STATUS.md`.
2. Work on the current roadmap phase only.
3. Update `docs/STATUS.md` with what shipped and how to test it.
4. Commit. One task per commit.

## Rules

1. **No scope creep.** A cut item comes back only through the roadmap. Accounts, the ranking and the daily challenge each need a server; none of them helps the first ten seconds.
2. Every non-trivial, reversible decision gets an ADR in `docs/adr/`. ADRs are
   never deleted; a new one replaces an old one.
3. The page credits only "Feito por Coleoni", linking to coleoni.com.
4. Copy follows `docs/voice.md`: short, no emoji, in English and Portuguese.

## Docs

| File | What it holds |
| --- | --- |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases and their status |
| [`docs/STATUS.md`](docs/STATUS.md) | Blockers, what shipped, how to test |
| [`docs/design-system.md`](docs/design-system.md) | Tokens and visual rules, from the approved screens |
| [`docs/voice.md`](docs/voice.md) | How the game talks to the player |
| [`docs/glossary.md`](docs/glossary.md) | The game's words |
| [`docs/adr/`](docs/adr/README.md) | Decisions, made and pending |
