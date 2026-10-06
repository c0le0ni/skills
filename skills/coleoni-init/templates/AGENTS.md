# <Project>: agent guide

> Read this first. It is the source of truth for what this project is and how
> work happens here. Details live in `docs/`.

## What it is

<One paragraph: who it is for, what problem it solves, the first release.>

## What it is not

<Each item the scope cut on purpose, with the reason. When someone asks for one
of these, point here.>

- <Item>: <why, e.g. "stays in Square, which already does it">.

## Stack and setup

*Pending (ADR-0001).* Versions, the single dev port, scripts and demo access go
here once the stack is decided.

## Visual identity

<Two lines: the feel, the accent and how it is used.> Tokens in
[`docs/design-system.md`](docs/design-system.md).

## Current state

What shipped and how to test it: [`docs/STATUS.md`](docs/STATUS.md).
What comes next: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Workflow

1. Check the blockers at the top of `docs/STATUS.md`.
2. Work on the current roadmap phase only.
3. Update `docs/STATUS.md` with what shipped and how to test it.
4. Commit. One task per commit.

## Rules

1. **No scope creep.** A cut item comes back only through the roadmap.
2. Every non-trivial, reversible decision gets an ADR in `docs/adr/`. ADRs are
   never deleted; a new one replaces an old one.
3. <Team conventions: commit language, branch names, review.>

## Docs

| File | What it holds |
| --- | --- |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases and their status |
| [`docs/STATUS.md`](docs/STATUS.md) | Blockers, what shipped, how to test |
| [`docs/design-system.md`](docs/design-system.md) | Tokens and visual rules |
| [`docs/glossary.md`](docs/glossary.md) | The client's words |
| [`docs/adr/`](docs/adr/README.md) | Decisions, made and pending |
