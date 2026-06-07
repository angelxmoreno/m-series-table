# Contributor Friendliness — Discussion Doc

A list of changes that will make this repo easy (and safe) for outside contributors
to engage with, ordered roughly by impact and effort. This is a discussion
document, not a plan — please push back on anything you disagree with before we
turn it into tickets / a plan.

## Three questions you asked (and my answers)

These came up before this doc was written, and they're the kind of question a
new contributor will ask in the Reddit thread. I'm putting the answers here at
the top so we have a shared response ready and so they don't gate any of the
P0/P1 work below.

### "What do you mean by a TypeScript rewrite? Do we need one?"

A TypeScript rewrite means renaming every `.js` / `.jsx` file to `.ts` /
`.tsx`, adding a `tsconfig.json`, adding `@types/*` packages for our deps
(React, TanStack Table, PostHog, etc.), and adding a type-check step to CI.
The benefit: it would make the `COLUMN_DEFS` schema self-documenting — a
typo in `chips.json` like `maxUnifiedMemmoryGB` would surface at build time
instead of silently rendering blank cells. It also makes refactors safer.

**Do we need one?** Yes — and soon, before the second wave of
contributors (feature work, refactors) starts landing. The first wave
(data corrections) tolerates plain JS fine. The schema-error class of
bugs (`accessorKey` typos in `chips.json` and the corresponding
`COLUMN_DEFS` entries) is exactly the layer TypeScript catches, and
that's a layer that grows non-linearly with the second wave.

**How soon:** do the TS port as part of the P0 toolchain pass, before
the Reddit post goes up. Sequence: add `typescript` + `tsconfig.json` +
`@types/*`, port files in 1–2 PRs (start with `chips.json` typing +
`COLUMN_DEFS` since that's the schema-critical pair), add `tsc --noEmit`
to CI. Biome's format/import-sort rules still apply in a TS project, so
the Biome step moves up to P0 alongside it (see item 8).

**The honest cost:** every PR diff will grow by ~30–100% while the
codebase is being typed (more `interface Chip { ... }` blocks, more
generic parameters on filter functions). After the port, the per-PR
overhead drops to "a few `as const` / type annotations on new code,"
which is much less than the up-front hit.

### "What's Storybook?"

Storybook is a dev tool that renders each React component in isolation —
you open `localhost:6006` in your browser, click through a gallery of
"stories" (e.g. `FilterDialog/Set`, `FilterDialog/Range`, `ColumnsPopover`),
and tweak props in a sidebar to see how the component behaves in different
states. It's primarily a development tool for design systems with many
components.

**Do we need one?** No. We have one main component. Adding Storybook
means a new dev server, a new config file, a new dependency, and zero
end-user benefit at the current size. If we ever grow to a real component
library (FilterDialog, ColumnsPopover, ChipRow, TierBadge, etc., each
used in multiple places), Storybook becomes worth it.

### "Why mention a new state / router / data library? Do we need one?"

The most common suggestions in this category are:
- **`nuqs`** — a library for syncing React state with URL query params
- **`react-router`** — a client-side router
- **`zustand` / `jotai`** — global state stores

**Do we need one?** No. The whole point of the URL-as-state architecture
we already have (`src/urlState.js` plus the `popstate` listener in
`AppleSiliconTable.jsx`) is that there is no router and no store. The URL
*is* the state. Adopting any of these libraries would mean ripping out
code that already works and depending on a third-party API with its own
release schedule. The trigger to reconsider is a real need — e.g. "we
want a `/chips/M3-Pro` detail page" (router) or "we want a
multi-table dashboard with shared state across tables" (store). Not "let's
use what everyone else uses."

---

## P0 — do this before the Reddit post

### 1. Rotate the PostHog token in `.env`
**Why it matters:** `.env` is gitignored and has never been committed, so the
token isn't in git history. The exposure surface is the local machine only —
if the laptop is lost, stolen, or backed up somewhere you don't control, the
token leaks. Rotating is still worth doing, but the urgency and the work
are both smaller than this section originally implied. (This is one of two
factual corrections after the P0 pass — see the "Corrections" section at the
bottom of this doc.)

**Action:**
- Rotate the project token in the PostHog dashboard.
- Update the repo's GitHub Actions secret `VITE_POSTHOG_PROJECT_TOKEN` to the new value.
- Update the local `.env` with the new token so dev builds still work.
- Confirm `.env` is in `.gitignore` (it already is) and `git status` is clean.
- **No `git filter-repo` needed** — there's nothing to rewrite.

### 2. Add a `CONTRIBUTING.md`
**Why it matters:** Reddit contributors will land in the repo and look for one
document that says "how do I contribute." Without it, every first-time
contributor asks the same setup questions in the comments.

**What it should cover:**
- The two most common contribution types (data correction, code change) and
  the path for each.
- Dev setup: `bun install`, `bun run dev`, `bun run test`, `bun run build`.
- For data changes: edit `src/chips.json` only, leave a `source:` comment in
  the PR description (Apple's newsroom / press release URL).
- For code changes: branch from `main`, run tests, add tests for the change,
  open a PR.
- Coding style: how the existing code is organized (small pure functions in
  `src/*.ts`, React in `src/*.tsx`, no class components, Tailwind classes
  inline, daisyUI primitives over hand-rolled). After the TS port (item 8),
  this becomes `.ts` / `.tsx`.
- PostHog: do not add new analytics events without checking — there's a
  privacy expectation and a quota.
- PR template reminder: fill in the "what / why / screenshots" section.

### 3. Add a PR template
**Why it matters:** Forces every contributor to declare what they changed and
how they tested it. Saves a round-trip on every PR.

**Path:** `.github/pull_request_template.md` with sections for: description,
screenshots (for UI), test plan (which tests run / new tests added), data source
(if chips.json was edited), and a checkbox list ("I ran `bun run test`",
"build is clean", "I read CONTRIBUTING.md").

### 4. Add issue templates
**Why it matters:** Most contributions will start as issues. A template turns
"yo the M3 Pro has the wrong GPU core count" into something actionable with the
fields we need (chip name, claimed value, actual value, source URL).

**Path:** Two templates in `.github/ISSUE_TEMPLATE/`:
- `data-correction.yml` — chip name, field, current value, correct value, source.
- `bug-report.yml` — repro, expected, actual, browser/OS, screenshot.
- A third optional one: `feature-request.yml` with a "use case" field so we
  can tell signal from noise.

### 5. Update README to point at the contributor paths
The current README mentions `src/chips.json` and the table UI but never says
"to contribute, see CONTRIBUTING.md" or links to the issue templates. Add a
"Contributing" section at the bottom that points to CONTRIBUTING.md, FORKING.md,
and the two issue templates.

### 6. Move tests to a co-located layout
**Why it matters:** Today, tests live in `src/test/`. That makes the test
folder easy to miss — a contributor opening the repo to edit
`AppleSiliconTable.jsx` doesn't see its test sitting in the same file
picker. Three common layouts, with the trade-offs:

| Layout | Example | Tests sit... | Discoverability | Test/source pairing |
|---|---|---|---|---|
| **Co-located** (this recommendation) | `src/AppleSiliconTable.tsx` + `src/AppleSiliconTable.test.tsx` | Beside what they test | Strong — visible in the source tree. | Strongest possible. |
| `src/test/` (current) | `src/AppleSiliconTable.tsx` + `src/test/AppleSiliconTable.test.tsx` | One level under `src/` | A subfolder under `src/`; a non-test contributor might skip it. | One-hop. |
| `tests/` at root | `src/AppleSiliconTable.tsx` + `tests/AppleSiliconTable.test.tsx` | Top-level alongside `src/` | Clean "src = edit, tests = run" split. | Two-hop. |

**Recommendation: co-located.** The strongest argument is the
test/source pairing — when you open a file to change it, the test file is
right there, and you're one click from "let me make sure my change
doesn't break this test." Vitest's auto-discovery (matches
`**/*.test.{js,jsx,ts,tsx}`) doesn't care where tests live, so the move
is mechanical: rename `src/test/AppleSiliconTable.test.jsx` to
`src/AppleSiliconTable.test.jsx`, ditto for the other two test files, and
move `src/test/setup.js` to `src/test-setup.ts` (or keep it in a
`src/test/` folder as a pure tooling file — Vite/Vitest will only treat
`.test.*` files as tests, so `setup.js` is safe to leave in the same
folder either way).

**Correction after execution:** this section originally listed three test
files; the actual count is five (the four listed below plus `csv.test.js`,
which stays in `src/test/` because it tests the CSV re-export at
`export-csv.js` in the repo root, not anything in `src/`). `fmt.test.js`
was a sixth before the TS port extracted `fmt` to its own file and moved
the test with it.

**Action:**
- `git mv src/test/AppleSiliconTable.test.jsx src/AppleSiliconTable.test.jsx`
- `git mv src/test/summarize.test.js src/summarize.test.js`
- `git mv src/test/urlState.test.js src/urlState.test.js`
- `git mv src/test/chips.test.js src/chips.test.js` (covers `chips.json`)
- `git mv src/test/setup.js src/test-setup.js` (and update the import
  in `vite.config.js`).
- `src/test/csv.test.js` stays in `src/test/` — it tests the CSV re-export
  at `export-csv.js` (repo root), not anything in `src/`. The TS port
  (item 8) renames it to `.ts` and the `src/test/` comment in
  `test-setup.ts` explains why.
- Run `bun run test` to confirm everything still picks up.

### 7. Add a standalone `FORKING.md`
**Why it matters:** "I want to run my own version of this" is a different
intent from "I want to contribute a change upstream." They're different
audiences with different needs: contributors want to know the dev loop;
forkers want to know the deploy loop. Mixing them in the README keeps it
aimed at contributors and lets the forking guide be its own deep-dive.

**What it should cover** (lifted out of the README's current GitHub Pages
section, expanded):
- How to enable GitHub Pages on a fork (Settings → Pages → GitHub Actions).
- How to set up the custom domain (CNAME file, DNS records, A vs CNAME).
- How to rotate the PostHog token for a fork (your fork gets its own
  PostHog project; don't reuse the upstream token).
- The `base: "/"` in `vite.config.js` — when you need to change it (subpath
  hosting), and when you don't (custom domain).
- A troubleshooting section for the 90% cases: "my fork builds but the
  page is blank" (almost always `base`), "my custom domain 404s" (DNS
  propagation or wrong CNAME target), "PostHog isn't loading" (the
  GitHub Actions secret was never set on the fork).
- A short note that PRs back to the upstream repo are welcome if the
  change is also useful there.

**Path:** `FORKING.md` at the repo root, linked from the README.

## P1 — first weekend after the post

### 8. Port the codebase to TypeScript  *(done in P0 pass)*
**Status:** Shipped — see commit `29caf2d` "feat: port codebase to TypeScript
with strict mode". All 138 tests pass under `bun run test`, `bun run typecheck`
is clean, and `bun run build` succeeds. The `Chip` and `Column` types live in
`src/types.ts` and the filter map derives its discriminated union from
`Column["filter"]` (so adding a new filter type is a compile error in
`parseState` and `serializeState` until you handle it).
**Why it matters:** This is the schema-safety layer. Once the project has
more than a couple of contributors, the bug class that shows up most is
"`accessorKey` in `chips.json` doesn't match the column-defs array" —
typos like `maxUnifiedMemmoryGB` silently render blank cells and only
get caught by a careful visual review. TypeScript catches them at build
time. It also gives `COLUMN_DEFS` a real type so a new contributor adding
a column gets red squiggles on the wrong type for `filter.values`.

**Action (in order):**
1. Add `typescript` and `@types/react` / `@types/react-dom` to
   `devDependencies`. Add a `tsconfig.json` (strict, `jsx: "react-jsx"`,
   `target: "ES2022"`, `moduleResolution: "bundler"`).
2. Rename `.js` / `.jsx` → `.ts` / `.tsx`. Update the imports.
3. Define a `Chip` type that mirrors `chips.json`, and a `Column` type
   for `COLUMN_DEFS`. The `Chip` type is the schema-critical one — once
   it's there, all the table filtering/display code gets typed against
   it for free.
4. Fix the type errors that surface (probably a dozen in
   `AppleSiliconTable.tsx` from the dynamic filter lookups).
5. Add `bun run typecheck` → `tsc --noEmit`. Add it to CI (item 11).
6. Update `vite.config.js` to use the new file extensions and run
   `tsc` as a pre-build step.

**Cost:** expect 1–2 PRs of churn, mostly mechanical. The first PR
("rename everything + add `tsconfig.json`") will be the biggest diff
because of the file renames. The second PR ("fix what broke") will be
smaller and more interesting.

**What to do when contributors run into it:** mention in CONTRIBUTING.md
that "the first run of `bun install` after the port may need a
`bunx tsc --noEmit` warmup." Almost no one will actually hit this; it's
just a heads-up that the toolchain is slightly heavier than `vite` alone.

### 9. Add a formatter + linter (Biome)  *(done in P0 pass)*
**Status:** Shipped — see commits `c210687` "chore: add Biome for formatting
and linting" and `134d9d3` "style: apply biome format and refine config".
`biome.json` configures a formatter (2-space, double quotes, semicolons, ES5
trailing commas, 100 char line width) + linter (with a few rules disabled:
`noAutofocus` on the filter dialogs, the no-keyboard-handler rules on the
sort header span, and `noNonNullAssertion` to avoid `!` ceremony at the
strict-mode call sites). `bun run lint` and `bun run format` are wired up;
both run in CI.
**Why it matters:** With many contributors, every PR becomes a style debate.
A formatter + linter removes the debate. Do this in the same P0 pass as
the TS port — Biome handles `.ts` / `.tsx` files the same as `.js` / `.jsx`,
and it's a single install.

**Recommendation:** [Biome](https://biomejs.dev/) — single Rust binary that
does formatting, linting, and import sorting with one config file
(`biome.json`). No plugin ecosystem, no Prettier-vs-ESLint config drift,
~10x faster than the alternatives. Add `bun run lint` and `bun run format`
scripts. Run `biome format` once on the codebase as a single "format on
board" commit. Biome's defaults are sensible; the only config we need is
to set the project to "use tabs / no semicolons" (or whatever the
existing code is) and the formatter handles the rest.

**Why not Prettier + ESLint:** They're fine tools but they're two configs
to maintain, a plugin ecosystem to curate, and ESLint's value (catching
real bugs in React code) is mostly already covered by Vitest's test suite
and TypeScript's type checker. Biome is the modern single-tool answer to
the same problem.

**Linting in a TS project:** Biome's built-in rules catch a real subset of
what ESLint would (unused imports, `noExplicitAny` violations, basic
correctness rules). For anything deeper — React-specific patterns,
hook-usage rules — we'd add an ESLint pass on top later if a real
maintenance burden shows up. For now, Biome + tsc + tests is the right
floor.

### 10. CI: run tests + build + typecheck + lint on PRs  *(done in P0 pass)*
**Status:** Shipped — see commit `7320d25` "ci: add pull_request workflow
running lint, typecheck, test, build". `.github/workflows/ci.yml` runs the
same four checks (`bun run lint`, `bun run typecheck`, `bun run test`,
`bun run build`) on every PR. PostHog env vars are stubbed in CI with
placeholder values — the build embeds them as JSON literals, it never
connects from CI.
**Why it matters:** `deploy.yml` runs on push to `main` and deploys. There's
no PR-time check that catches a broken test, type error, or lint error
before a contributor hits merge. A red CI badge on a PR is also a strong
"this isn't ready" signal that contributors understand.

**Action:** Add `.github/workflows/ci.yml` that runs on `pull_request`:
`bun install`, `bun run typecheck`, `bun run lint`, `bun run test`,
`bun run build`. Don't deploy. Require it to pass before merge via
branch protection rules.

### 11. Add `CODE_OF_CONDUCT.md`
**Why it matters:** A short Contributor Covenant. Sets expectations for
discourse on issues / PRs / Reddit. Mostly a signaling thing but it's the
kind of file maintainers point to when they need to say "this is a
technical disagreement, not a personal one."

### 12. Issue labels  *(done in P0 pass)*
**Status:** Shipped. All eight default labels (`bug`, `documentation`,
`duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`,
`question`, `wontfix`) were already present, and `data-correction` was
added during the P0 pass.
**Why it matters:** Sortable backlog. A small fixed set covers 95% of use:
`data-correction`, `bug`, `enhancement`, `question`, `good first issue`,
`help wanted`, `wontfix`, `duplicate`. Avoid letting the label list grow
organically.

### 13. `good first issue` grooming  *(done in P0 pass)*
**Status:** Five issues created and labeled `good first issue`:
- #2 — Add M4 Ultra entry to `src/chips.json` (`data-correction`)
- #3 — Add M5 Ultra entry to `src/chips.json` (`data-correction`, waiting on Apple)
- #4 — Add `docs/SCHEMA.md` describing the chips schema (`documentation`)
- #5 — Audit column descriptions in `src/AppleSiliconTable.tsx` (`documentation`)
- #6 — Test the table on a mobile viewport and file UI bugs (`bug`)
**Why it matters:** Most first-time contributors filter by this label. Curate
3–5 small, well-scoped tasks (typo in a description, a missing column, a
new data point for an existing chip) and label them before the post. They
serve as both "I want to contribute" bait and a smoke test of the
contributor flow.

## P2 — nice to have, schedule later

### 14. Document the column schema in one place
**Why it matters:** Right now, the `COLUMN_DEFS` array at the top of
`src/AppleSiliconTable.tsx` is the implicit schema for the table — it
controls what's shown, what filters are available, what the units are, and
the hover description. New contributors (and future-us) have to read the
React component to discover that "Max RAM" is `maxUnifiedMemoryGB` and
"Bandwidth" is `memoryBandwidthGBs` and uses GB/s.

**Action:** Add a `docs/SCHEMA.md` (or a `## Column schema` section in
CONTRIBUTING.md) that maps every accessorKey in `chips.json` to its display
header, units, description, and which filter type (if any) it uses. Link
from CONTRIBUTING.md and from a comment at the top of `COLUMN_DEFS`. After
the TS port, the `Chip` type is the canonical schema reference — SCHEMA.md
should defer to it for the type info and add the human-facing display
header / units / description on top.

### 15. CHANGELOG.md
The commit log is fine for a one-author project. With many contributors, a
human-maintained CHANGELOG (one section per release, summarizing
user-visible changes) is the kind of thing Reddit readers check before
upgrading / bookmarking. Use `git-cliff` or similar to generate from
conventional commits if you want it auto-generated.

### 16. Renovate / Dependabot
The deps are stable today but a few of them (`@tanstack/react-table`,
`tailwindcss`, `react`) will get major bumps in the next year. A bot PR
that bumps them in a controlled way is better than a panic upgrade later.

### 17. A "preview deploy" per PR
GitHub Pages doesn't do per-PR previews out of the box, but Cloudflare
Pages / Netlify do, and the cost is free for a project this small. A
"view this PR live at <url>" comment on every PR is the single biggest UX
win for UI contributors. Out of scope for the first round, but worth
migrating to a host that supports it if contributor PRs start being
visual.

### 18. CoC enforcement contact + private reporting channel
The CoC should name a person (or two) and an email. For a one-maintainer
project this is you. For a project that anticipates many strangers, having
a private reporting path is what makes the CoC actually enforceable.

### 19. A LICENSE clarification in CONTRIBUTING
Some contributors will ask "by submitting a PR, what license am I
granting?" The MIT LICENSE on this repo is the answer — but say so
explicitly in CONTRIBUTING so it's not a guessing game.

## Suggested ordering

If you want to do this in one sitting before posting to Reddit:
1. Rotate the PostHog token (P0-1). Non-negotiable.
2. Write CONTRIBUTING.md, the PR template, the issue templates, the CoC,
   and the forking guide. All short docs; can be drafted in one pass.
3. Update the README to link to all of the above.
4. Move the tests to a co-located layout (mechanical `git mv`).
5. Port the codebase to TypeScript (item 8). 1–2 PRs.
6. Add Biome and a one-time `biome format` commit.
7. Add the CI workflow with typecheck + lint + test + build.
8. Triage 3–5 `good first issue` candidates from the existing
   `chips.json` / column-defs and label them.
9. Post to Reddit.

Items 14–19 (CHANGELOG, Renovate, preview deploys, etc.) are not blockers
and can wait for the first wave of contributors to land.

---

## Corrections to the P0 pass *(added after execution)*

Two factual errors in the P0 section surfaced during execution:

1. **The PostHog token was never in git history.** `.env` is gitignored and
   was never committed. The risk in P0-1 ("anyone who clones the repo has
   it") doesn't apply. The local-machine-only risk is real, so rotation is
   still worth doing, but the urgency is lower than originally framed and
   the `git filter-repo` history rewrite is not needed.

2. **Five test files exist, not three.** The P0-6 list of `git mv`
   commands missed `src/test/chips.test.js` and `src/test/csv.test.js`.
   The four that have a clean source pair in `src/` are co-located;
   `csv.test.js` stays in `src/test/` because it tests the CSV re-export
   at `export-csv.js` in the repo root, not anything in `src/`. After the
   TS port extracted `fmt` to its own file (`src/fmt.ts`), `fmt.test.js`
   also moved out of `src/test/`.

P0-8, P0-9, P0-10, P0-12, and P0-13 all shipped in the P0 pass and are
marked *(done in P0 pass)* above.
