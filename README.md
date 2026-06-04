# Apple Silicon M-Series Comparison

A hacker-themed, filterable, sortable comparison table for every Apple Silicon M-series chip — M1 through M5 Max. Built with Bun, Vite, React, and TanStack Table. Data lives in a single editable JSON file.

## Stack

- **Bun** — package manager + runtime
- **Vite** — bundler
- **React 19** — UI
- **TanStack Table v8** — sorting and filtering logic
- **Tailwind CSS v4** + **daisyUI v5** — styling (built-in `dark` theme)

## Getting Started

```bash
bun install
bun run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
apple-silicon-table/
├── index.html                  # Vite entry point
├── package.json
├── vite.config.js
├── export-csv.js               # Bun CLI script to export chips.csv
└── src/
    ├── main.jsx                # React root
    ├── index.css               # Tailwind + daisyUI imports
    ├── AppleSiliconTable.jsx   # Main table component
    └── chips.json              # All chip data — edit this to update the table
```

## Editing the Data

All chip data lives in `src/chips.json`. Each entry looks like this:

```json
{
  "chip": "M4 Pro",
  "generation": "M4",
  "tier": "Pro",
  "year": 2024,
  "processNode": "3nm (N3E)",
  "cpuCores": 14,
  "perfCores": 10,
  "efficiencyCores": 4,
  "gpuCores": 20,
  "neuralEngineCores": 16,
  "neuralEngineTOPS": 38,
  "maxUnifiedMemoryGB": 64,
  "memoryBandwidthGBs": 273,
  "transistorsBillions": 45,
  "thunderbolt": "TB5"
}
```

Set any numeric field to `null` if the value is unknown — it will render as `—` in the table.

## Exporting to CSV

Exports the full dataset from `src/chips.json` to `chips.csv` in the project root:

```bash
bun run export-csv
```

The **Export CSV** button in the UI also works — it exports whatever is currently visible after filters are applied.

## Using the Table

- **Search** — filter by chip name (e.g. `M3 Max`)
- **Click ▾ on a column header** — open that column's filter dialog
  - Set filters (Gen, Tier, TB) — checkbox list of values
  - Range filters (Year, CPU/Perf/Eff/GPU Cores, TOPS) — min/max number inputs
  - `Clear` resets that column; `Done` commits; `Esc` or backdrop click closes
- **Click a column header** — sort ascending/descending
- **Hover a column header** — see the full description for that column
- **Columns button** — pick which columns to show/hide
- **Export CSV button** — downloads the current filtered view as a CSV

## Building for Production

```bash
bun run build
```

Output goes to `dist/`. Deploy that folder anywhere static — GitHub Pages, Cloudflare Pages, Netlify, etc.

### GitHub Pages

```bash
bun add -d gh-pages
```

Add to `package.json` scripts:

```json
"deploy": "gh-pages -d dist"
```

Then:

```bash
bun run build && bun run deploy
```

## Notes

- M5 TOPS and transistor counts are `null` — Apple has not published official figures yet
- M5 Pro/Max use a new core naming convention (Super + Performance cores) but are mapped to the same `perfCores`/`efficiencyCores` fields for consistency
- No M4 Ultra was released — Apple skipped it
- M5 Ultra is not yet announced

## License

[MIT](LICENSE) © 2026 Angel S. Moreno
