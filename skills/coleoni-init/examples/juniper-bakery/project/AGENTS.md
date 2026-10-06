# Juniper Bakery: agent guide

> Read this first. It is the source of truth for what this project is and how
> work happens here. Details live in `docs/`.

## What it is

A small web app for a neighborhood bakery: customers order ahead from their
phone (today's menu and cakes with a pickup date), the counter sees every order
of the day on a tablet and marks it ready, and the customer gets a WhatsApp
confirmation. The first release exists to stop orders getting lost in the chat.

## What it is not

- Card payments and sales reports: stay in **Square**, already used in the shop and by the accountant.
- Photos and promotions: stay on **Instagram**; the site links to it.
- Wholesale standing orders: stay in the **Google Sheet**, which works.
- Loyalty points: the **paper stamp card** works; revisit after launch.
- Delivery and driver tracking: roadmap, there is one car.
- Online payment: roadmap, paying at pickup is fine for now.

## Stack and setup

*Pending (ADR-0001).* Versions, the single dev port, scripts and demo access go
here once the stack is decided.

## Visual identity

Warm and plain, like the shop: cream paper, deep sage ink, a terracotta accent
only on small things (badges, the "ready" state). Tokens in
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
3. The counter board must work with one hand, on a basic tablet, with no training.

## Docs

| File | What it holds |
| --- | --- |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases and their status |
| [`docs/STATUS.md`](docs/STATUS.md) | Blockers, what shipped, how to test |
| [`docs/design-system.md`](docs/design-system.md) | Tokens and visual rules |
| [`docs/glossary.md`](docs/glossary.md) | The bakery's words |
| [`docs/privacy.md`](docs/privacy.md) | Customer data: name and WhatsApp number |
| [`docs/adr/`](docs/adr/README.md) | Decisions, made and pending |
