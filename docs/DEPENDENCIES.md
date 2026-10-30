# Dev tool dependencies

The page itself installs nothing: it loads Preact, htm, OpenCV.js and MediaPipe from a CDN (import map in
`index.html`). Everything in `package.json` is a dev tool (tests, type check, CSS build, local server).

## Package manager

pnpm, exact version in `packageManager` in `package.json`. Run `corepack enable` once (Corepack comes with
Node.js); after that `pnpm` uses that version by itself. `pnpm-lock.yaml` is committed.

## Safe versions policy (`pnpm-workspace.yaml`)

- **Exact versions only.** `package.json` lists `1.2.3`, never `^1.2.3`; `savePrefix: ''` makes `pnpm add` do the same.
- **Minimum release age: 7 days.** pnpm does not install a version younger than that. If a malicious release gets
  published, it is usually pulled within days, before it reaches us.
- **No install scripts.** `onlyBuiltDependencies` is empty: no package may run code on install.
- **Overrides only for a known fix** that exists upstream but has not reached us yet, one comment line each.
- **Audit gate.** `pnpm test` ends with `pnpm audit --audit-level=moderate`. A new advisory makes it fail.
  We fix it, or list it here under "Known advisories" with a reason. We never ignore one without a note here.

## Exceptions, and why

| Setting | Entry | Why | Remove when |
|---|---|---|---|
| `minimumReleaseAgeExclude` | `@mediapipe/tasks-vision@1.1.1` | Must equal the import map version; released 2026-10-14 | after 2026-10-21 |
| `ignoredBuiltDependencies` | `@parcel/watcher` | Tailwind's file watcher. Its install script only compiles from source when no prebuilt binary fits; the prebuilt one is installed as `@parcel/watcher-<os>-<cpu>` | never needed |
| `overrides` | `@parcel/watcher` → `2.6.0` | Fixes [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (braces, high): 2.6.0 no longer uses micromatch/braces. `@tailwindcss/cli@4.3.3` still pins 2.5.1 | a `@tailwindcss/cli` release that depends on `@parcel/watcher` 2.6.0 or newer |

## Known advisories

None. `pnpm audit` reports 0 vulnerabilities (checked 2026-10-16).

## Accessibility check

`axe-core` (4.14.0, issue #154): the standard WCAG rule set (contrast, labels, roles), injected into each page by
`pnpm a11y` (`scripts/a11y.js`, headless Chrome over the DevTools protocol, no browser package). One file, no
dependencies, no install script; we do not hand-write contrast or label rules.

## Local server

`pnpm dev` runs [`@web/dev-server`](https://modern-web.dev/docs/dev-server/overview/) (`wds --watch`, started by `scripts/dev-server.js`) on port
8080 for the owner, 4000–4999 for agents (see README, "Ports"), next to the Tailwind watcher. It replaced `live-server@1.2.2`, which is unmaintained and pulled in most of the
old audit findings (`chokidar@2` → `braces@2`, `http-auth` → `uuid@3`, …). Why `@web/dev-server`: maintained
(1.0.0 released 2026-07), 0 advisories, no install scripts, and it serves the files as they are (without
`--node-resolve` it leaves the import map and the CDN imports alone). `five-server`, the live-server fork, still
pulls in the vulnerable `braces`.
