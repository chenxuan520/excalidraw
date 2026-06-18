# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- Install dependencies: `yarn`
- Start the app locally: `yarn start`
- Build the app: `yarn build`
- Build the app for Docker/no Sentry: `yarn build:app:docker`
- Preview the production build: `yarn build:preview`
- Run all checks: `yarn test:all`
- Run app/unit tests: `yarn test:app`
- Run a single Vitest test file: `yarn test:app excalidraw-app/tests/collab.test.tsx`
- Run tests in watch-disabled mode: `yarn test:app --watch=false`
- Update snapshots: `yarn test:update`
- Run lint: `yarn test:code`
- Run typecheck: `yarn test:typecheck`
- Run formatting check: `yarn test:other`
- Auto-fix lint/format issues: `yarn fix`
- Build the published editor package artifacts: `yarn --cwd packages/excalidraw build:esm`
- Start the package example/dev flow: `yarn --cwd packages/excalidraw start`
- Build the utils package: `yarn --cwd packages/utils build:esm`
- Run the Go backend: `cd backend && go run .`

## Repository shape

This is a Yarn v1 monorepo with three main code areas:

- `packages/excalidraw`: the core reusable editor package published as `@excalidraw/excalidraw`
- `excalidraw-app`: the first-party web app built on top of the core package
- `packages/utils`: a smaller published utilities package

There is also a small Go service in `backend/`, custom build/release tooling in `scripts/`, shared static assets in `public/`, and docs content in `dev-docs/`.

## Architecture overview

### Core editor package

`packages/excalidraw` is the real center of the codebase. It contains the editor runtime, scene/data model, rendering, actions, element logic, i18n/locales, and most shared UI.

Important entrypoint:

- `packages/excalidraw/index.tsx`: public package entry for the reusable React component

When changing editor behavior, most of the real implementation will be in this package, not in `excalidraw-app`.

### App shell

`excalidraw-app` is not a loosely coupled consumer. It imports many internals directly from `packages/excalidraw` and layers product-specific behavior on top:

- app bootstrap and page shell
- local-first persistence
- share/import flows
- live collaboration UI and wiring
- Firebase-backed scene/file storage
- PWA setup
- app-specific menus, welcome screen, footer, and environment handling

Important entrypoints:

- `excalidraw-app/index.tsx`: mounts the app and registers the service worker
- `excalidraw-app/App.tsx`: top-level app orchestration, scene initialization, local storage restore, share/import handling, collaboration integration
- `excalidraw-app/vite.config.mts`: app build config

Because the app reaches into package internals, refactors inside `packages/excalidraw` can easily break the app even if the public package API looks unchanged.

### Collaboration and persistence

Realtime collaboration lives in the app layer, mainly under `excalidraw-app/collab/` and `excalidraw-app/data/`.

Key pieces:

- `excalidraw-app/collab/Collab.tsx`: collaboration state/UI integration
- `excalidraw-app/collab/Portal.tsx`: socket transport and room session wiring
- `excalidraw-app/data/index.ts`: collaboration/share-link parsing, backend import/export, encrypted room link helpers
- `excalidraw-app/data/firebase.ts`: Firebase scene/file persistence with client-side encryption

The browser app expects backend URLs via `VITE_APP_BACKEND_V2_GET_URL` / `VITE_APP_BACKEND_V2_POST_URL` for share/import flows. The Go service in `backend/main.go` is a very small auxiliary API (`/api/upload`, `/api/list`), not the whole collaboration backend.

### Build system

The repo uses custom scripts rather than a monorepo task runner.

- Root `package.json` delegates most app work to `excalidraw-app`
- `scripts/buildPackage.js` builds the main package artifacts
- `scripts/buildUtils.js` builds `packages/utils`
- `scripts/build-version.js` writes `excalidraw-app/build/version.json` and injects the version into built HTML
- `scripts/woff2/` contains a custom font pipeline used by both Vitest and Vite

`excalidraw-app/vite.config.mts` is important because it also defines repo-level assumptions:

- `envDir: "../"` means environment variables are loaded from the repository root
- `publicDir: "../public"` means app assets are sourced from the top-level `public/`
- locale chunking and PWA runtime caching are intentionally customized

## Repo-specific notes

- This repository is a fork with local changes called out in `README.md`, including Chinese font support, LaTeX support, broader URL embedding, release-packaged static frontend assets, and removal of tracking code. Do not assume exact parity with upstream Excalidraw.
- `packages/utils/index.ts` re-exports from `packages/excalidraw`, so package boundaries are somewhat porous here too.
- Vitest is configured at the repo root in `vitest.config.mts` with a jsdom environment and coverage thresholds.
- The app build output lives in `excalidraw-app/build`.
- The root `package.json` declares Node `18.0.0 - 25.x.x`; `.nvmrc` is `18`.
- If delegating review/research to a subagent for this repository, the prompt must explicitly say it is read-only and must not modify files, stage changes, or commit; if the task is not supposed to edit code, never omit that constraint.
- After every `git push` in this repository, monitor the corresponding GitHub Actions runs with `gh` until the relevant `Tests` / `build_and_release` workflows finish successfully before considering the task done.
- After every release tag push, additionally verify the GitHub Release asset `excalidraw-app.tar.gz` exists before stopping.
- If a workflow fails, inspect the failed logs first with `gh run view <run-id> --log-failed`; if the failure is in a test file, rerun that exact file locally (repeat if needed to assess flakiness) before deciding whether to change product code or stabilize the test itself.

## Guidance from repo docs

- There is no existing `CLAUDE.md`.
- There are no Cursor rules or `.github/copilot-instructions.md` in this repo.
- `README.md` mostly describes the upstream project plus this fork's customizations; for local development, prefer the actual workspace scripts in `package.json` over the README quickstart, which is aimed at consumers of the published npm package.
