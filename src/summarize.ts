// Build a human-readable summary of the current view state. Used in the
// header so a shared link (or just the current view) can be understood at
// a glance, without parsing the URL or clicking around.
//
// Output is an array of "fragments" — each is a small labeled piece of the
// summary that the caller can render in any layout. Examples:
//
//   summarizeState(...) → [
//     { kind: "default", text: "All 18 chips" },
//   ]
//
//   summarizeState(...) → [
//     { kind: "filter", key: "tier", text: "Max tier" },
//     { kind: "filter", key: "year", text: "2024 or later" },
//     { kind: "sort",   text: "sorted by year ↓" },
//   ]

import type { Column, FilterValue, Fragment, ViewState } from "./types";

const SORT_LABELS: Record<string, string> = {
  chip: "chip",
  generation: "generation",
  tier: "tier",
  year: "year",
  processNode: "process",
  cpuCores: "CPU cores",
  perfCores: "perf cores",
  efficiencyCores: "efficiency cores",
  gpuCores: "GPU cores",
  neuralEngineCores: "NE cores",
  neuralEngineTOPS: "TOPS",
  maxUnifiedMemoryGB: "max RAM",
  memoryBandwidthGBs: "bandwidth",
  transistorsBillions: "transistors",
  thunderbolt: "Thunderbolt",
};

// Look up a friendly column header. Falls back to the camelCase accessorKey
// split into words if the column isn't registered.
function columnLabel(col: Column | undefined): string {
  return (
    SORT_LABELS[col?.accessorKey as string] ?? col?.header ?? (col?.accessorKey as string) ?? "?"
  );
}

function formatRange(filter: { min: number; max: number }, value: FilterValue): string | null {
  if (!Array.isArray(value)) return null;
  const [lo, hi] = value;
  const atMin = lo === filter.min;
  const atMax = hi === filter.max;
  if (atMin && atMax) return null; // default
  if (atMin) return `${formatNum(hi)} or less`;
  if (atMax) return `${formatNum(lo)} or later`;
  return `${formatNum(lo)}–${formatNum(hi)}`;
}

function formatNum(n: number): string {
  // Integers stay as integers; floats keep one decimal place.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function summarizeState(
  state: Pick<ViewState, "q" | "sorting" | "visibleCols" | "columnFilters">,
  columns: Column[],
  defaultVisible: string[],
  totalCount?: number
): Fragment[] {
  const { q, sorting, visibleCols, columnFilters } = state;
  const fragments: Fragment[] = [];
  let hasAny = false;

  // Search
  if (q) {
    fragments.push({ kind: "search", text: `matching "${q}"` });
    hasAny = true;
  }

  // Column filters
  for (const col of columns) {
    const f = columnFilters[col.accessorKey];
    if (f === undefined) continue;
    const label = columnLabel(col);

    if (col.filter?.type === "set" && f instanceof Set) {
      // Use the column's canonical value order for stability.
      const values = col.filter.values.filter((v) => f.has(v));
      const text =
        values.length === 1 ? `${values[0]} ${label}` : `${values.join(" or ")} ${label}`;
      fragments.push({ kind: "filter", key: col.accessorKey, text });
      hasAny = true;
    } else if (col.filter?.type === "range" || col.filter?.type === "range-discrete") {
      const text = formatRange(col.filter, f);
      if (text) {
        fragments.push({ kind: "filter", key: col.accessorKey, text: `${label} ${text}` });
        hasAny = true;
      }
    }
  }

  // Visible columns that differ from default
  const sameAsDefault =
    visibleCols.size === defaultVisible.length && defaultVisible.every((k) => visibleCols.has(k));
  if (!sameAsDefault) {
    const extra = columns
      .map((c) => c.accessorKey)
      .filter((k) => visibleCols.has(k) && !defaultVisible.includes(k));
    if (extra.length > 0) {
      const labels = extra.map((k) => columnLabel(columns.find((c) => c.accessorKey === k)));
      fragments.push({ kind: "cols", text: `+${labels.length} more` });
      hasAny = true;
    }
  }

  // Sort
  if (sorting.length > 0) {
    const s = sorting[0];
    if (s) {
      const col = columns.find((c) => c.accessorKey === s.id);
      fragments.push({
        kind: "sort",
        text: `sorted by ${columnLabel(col)} ${s.desc ? "↓" : "↑"}`,
      });
      hasAny = true;
    }
  }

  if (!hasAny) {
    return [
      { kind: "default", text: totalCount != null ? `All ${totalCount} chips` : "All chips" },
    ];
  }

  return fragments;
}

// Build a short browser-tab title. Stays under ~60 chars by being
// selective: search is highest signal, then the first active filter, then
// the count. Sort and extra visible columns are omitted — they bloat the
// title without telling the user anything at a glance.
const BASE_TITLE = "Apple Silicon · M-Series Comparison";

export function buildTitle(
  state: Pick<ViewState, "q" | "sorting" | "visibleCols" | "columnFilters">,
  columns: Column[],
  totalCount?: number,
  matchedCount?: number
): string {
  const { q, columnFilters } = state;
  const pieces: string[] = [];

  if (q) pieces.push(q);

  for (const col of columns) {
    const f = columnFilters[col.accessorKey];
    if (f === undefined) continue;

    if (col.filter?.type === "set" && f instanceof Set) {
      const values = col.filter.values.filter((v) => f.has(v));
      pieces.push(values.join(", "));
    } else if (col.filter?.type === "range" || col.filter?.type === "range-discrete") {
      const text = formatRange(col.filter, f);
      if (text) pieces.push(text);
    }
    if (pieces.length >= 2) break; // at most 2 filter pieces
  }

  if (pieces.length === 0) {
    return BASE_TITLE;
  }

  const tail = totalCount != null ? ` (${matchedCount ?? "?"}/${totalCount})` : "";
  let title = `${BASE_TITLE} · ${pieces.join(" · ")}${tail}`;

  // Hard cap at 80 chars for browser-tab sanity. Truncate the pieces
  // (never the base title or the count) and add an ellipsis if we cut.
  if (title.length > 80) {
    const head = BASE_TITLE;
    const room = 80 - head.length - tail.length - 3; // 3 = " · "
    const joined = pieces.join(" · ");
    const truncated = joined.length > room ? `${joined.slice(0, Math.max(0, room - 1))}…` : joined;
    title = `${head} · ${truncated}${tail}`;
  }

  return title;
}
