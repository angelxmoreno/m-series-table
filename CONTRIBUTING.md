# Contributing to Apple Silicon M-Series Comparison

Thanks for your interest in contributing! This project is a small, single-page
React app and a single JSON data file. Most contributions fall into one of
two buckets, and the path for each is below.

If you just want to run your own copy of the site, see
[`FORKING.md`](./FORKING.md) instead.

## I want to fix a wrong data point

This is the most common kind of contribution, and the easiest to land. The
entire dataset is one file: [`src/chips.json`](./src/chips.json). To correct
a value:

1. [Fork the repo](https://github.com/angelxmoreno/m-series-table/fork) and
   create a branch from `main`.
2. Edit the relevant entry in `src/chips.json`. Each entry has the same
   15-field shape — see the file for examples.
3. Open a PR. In the **Data source** field of the PR template, link the
   Apple newsroom / press release / chip page that confirms your value. PRs
   without a source will be asked to add one before merging.
4. The CI checks (`bun run test`, `bun run typecheck`, `bun run lint`,
   `bun run build`) will run automatically. For data-only changes, they
   should all pass without you touching any code.

## I want to change something in the code

1. [Fork the repo](https://github.com/angelxmoreno/m-series-table/fork) and
   create a branch from `main`.
2. Set up locally:
   ```bash
   bun install
   bun run dev       # starts the dev server on http://localhost:5173
   bun run test      # runs all tests once
   bun run typecheck # runs the TypeScript type checker
   bun run lint      # runs Biome
   bun run build     # builds for production
   ```
3. Make your change. **Before pushing**, run the four checks above and
   make sure they all pass.
4. Open a PR using the template. Fill in the "What changed" / "Why" /
   "Screenshots" / "Test plan" sections.
5. CI will run the same four checks on your PR. A red CI badge means one
   of the checks failed — fix it and push again.

### Coding style

- **Small pure functions in `src/*.ts`.** Anything that doesn't need React
  or the DOM goes in a plain `.ts` file. Look at `src/summarize.ts` and
  `src/urlState.ts` for the shape.
- **React in `src/*.tsx`.** One component per file when reasonable. The
  table is the main one (`AppleSiliconTable.tsx`).
- **Tailwind classes inline, daisyUI primitives over hand-rolled.** Don't
  reach for a new CSS file when a `className` will do.
- **Tests co-located with their source.** `AppleSiliconTable.tsx` is
  tested by `AppleSiliconTable.test.tsx`, sitting right next to it. If
  you add a new component, add its test beside it.
- **Strict TypeScript.** No `any` unless you have a good reason (and a
  comment explaining it). The `Chip` type in
  [`src/AppleSiliconTable.tsx`](./src/AppleSiliconTable.tsx) is the schema
  for the JSON data — keep it accurate.

### PostHog (analytics)

This project uses PostHog for a small number of analytics events. The
existing events are:

| Event | When it fires |
|---|---|
| `chip_searched` | User typed a query into the chip search box. |
| `column_sorted` | User clicked a column header to sort. |
| `column_filter_applied` | User confirmed a filter on a column. |
| `column_filter_cleared` | User cleared a filter. |
| `column_visibility_toggled` | User toggled a column in the Columns popover. |
| `csv_exported` | User clicked Export CSV. |

Don't add new analytics events without checking first — there's a privacy
expectation and a quota. If you have a question about what to track, open
an issue.

## Code of Conduct

This project follows a standard Contributor Covenant (see
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — not yet written, but coming
soon). In the meantime, be kind, be technical, and assume good faith.

## License

By submitting a pull request, you agree that your contribution will be
licensed under the project's [MIT License](./LICENSE).

## Questions?

Open an issue. The issue templates cover data corrections, bug reports,
and feature requests.
