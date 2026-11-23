---
name: order-deploy
description: How the order website (ordernaraipizzeria) is deployed, which branch a PR must target, and what else it depends on. It is on Vercel and deploys Production from `main`, which is NOT the GitHub default branch. Use whenever opening or merging a PR in this repo, telling the user when a change goes live, or when a change also needs office-server (narai-branch) or the office website.
---

# Deploying the order website (ordernaraipizzeria)

## Vercel deploys Production from `main`

- The order website is on **Vercel**. This is different from the office website (naraipizzeria),
  which moved off Vercel onto the office machine.
- Production deploys from **`main`**.
- GitHub's default branch for this repo is set to `claude/keen-ritchie-c7m8dt`, not `main`.
  A PR opened with default settings targets that branch, and merging it does **not** reach the live
  site. This happened with Narai-IT/ordernaraipizzeria#6, which had to be redone as #7.
- **Always open PRs with `base: main`.** Before opening one, merge `origin/main` into the working
  branch and run `npm test`, so the PR diff is only this change and nothing on `main` gets dropped.
- Every push gets a Vercel Preview build (a "Vercel" commit status plus a "Vercel Preview Comments"
  check). After a merge to `main`, the merge commit's "Vercel" status shows the Production deploy
  ("Vercel is deploying your app" → "Deployment has completed"). Nothing needs to be run on any
  machine for this site.
- Earlier PRs were merged with a merge commit ("Merge pull request #N"), not squash.
- Env vars (`AUTH_SECRET`, `USAGE_API_BASE`, `USAGE_API_TOKEN`, `NARAI_BRANCH_URL`) live in
  Vercel → Project Settings → Environment Variables. See `.env.example`.

## What this site depends on

This site has no database or server of its own. See the diagram at the top of `README.md`.

- **office-server** (in the `nookmagazineDev/narai-branch` repo, `office-server/ordershop.js`) owns
  every `orderShop*` action: shop list, login, items, and per-shop item lists. Its SQL is in
  `office-server/sql/ordershop-*.sql`. It is a public repo: read it with
  `git clone --depth 1 https://github.com/nookmagazineDev/narai-branch`. This session can't push to it.
  A change there goes live only after someone runs `update-office-server.bat` on the office machine.
- **narai-branch website**: `/api/insert_order` and `/api/pending_orders` (the POS order itself).
- **office website** (`nookmagazineDev/naraipizzeria`): the QC/RD → วัตถุดิบ page writes
  `dbo.stock_item_branch`. Since #9, ticking a branch there makes the item orderable for the shop
  with the same 3-letter code (see `lib/shopItems.js`). That repo has its own `office-deploy` skill.

Prefer changes that stay inside this repo. For example, #9 used the existing `orderShopGetItems`
action instead of changing office-server.

## Before pushing

- `npm test` must pass. There are no dependencies to install, just Node 20 or newer.
- `npm run demo` serves the site at http://localhost:3000 with sample data
  (shop `SUM` or any demo code / admin `admin`, password `123456`). Use it for screenshots.
