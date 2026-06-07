// URL-based state for the table. Single source of truth for what's shareable.
//
// State lives in `window.location.search` as URLSearchParams. Defaults are
// omitted so a clean URL reproduces the default view.
//
// Schema:
//   q       — free-text search string
//   sort    — "<col>:<asc|desc>" (single sort, matches current code)
//   cols    — comma-joined accessorKeys; omitted when equals defaultVisible
//   f_<key> — per-column filter:
//              set            → "v1,v2,..."
//              range          → "<min>:<max>" with empty bound for unbounded
//                               e.g. "2024:" = year ≥ 2024, ":2026" = year ≤ 2026
//              range-discrete → same as range, but the bound must be one of
//                               the column's discrete values. Out-of-set
//                               values are clamped to the nearest allowed one.

import type { Column, ColumnFilter, FilterValue, ViewState } from "./types";

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Deep-equality for columnFilters: compare sets and tuples element-wise.
function sameFilters(a: Record<string, FilterValue>, b: Record<string, FilterValue>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    const av = a[k];
    const bv = b[k];
    if (!bv) return false;
    if (av instanceof Set) {
      if (!(bv instanceof Set) || !sameSet(av, bv)) return false;
    } else if (Array.isArray(av)) {
      if (!Array.isArray(bv) || av.length !== bv.length) return false;
      for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
    } else {
      if (av !== bv) return false;
    }
  }
  return true;
}

// Parse a search string into view state. Defensive: ignores unknown keys,
// out-of-range numbers, malformed values. Never throws.
//
// `defaults` provides the default visible columns. `columns` is the augmented
// column list (with derived filter values, min/max) used to validate input.
export function parseState(
  searchString: string,
  columns: Column[],
  defaultVisible: string[]
): ViewState {
  const params = new URLSearchParams(searchString);
  const result: ViewState = {
    q: params.get("q") ?? "",
    sorting: [],
    visibleCols: new Set(defaultVisible),
    columnFilters: {},
  };

  // Sort
  const sort = params.get("sort");
  if (sort) {
    const [colId, dir] = sort.split(":");
    if (colId && (dir === "asc" || dir === "desc")) {
      const known = columns.find((c) => c.accessorKey === colId);
      if (known) {
        result.sorting = [{ id: colId, desc: dir === "desc" }];
      }
    }
  }

  // Visible columns
  const cols = params.get("cols");
  if (cols !== null) {
    const validKeys = new Set(columns.map((c) => c.accessorKey));
    const requested = cols.split(",").filter((k) => k.length > 0 && validKeys.has(k));
    if (requested.length > 0) {
      result.visibleCols = new Set(requested);
    }
    // If the URL says cols= with no valid keys, fall back to defaults
    // (don't render an empty table).
  }

  // Per-column filters
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("f_")) continue;
    const accessorKey = key.slice(2);
    const col = columns.find((c) => c.accessorKey === accessorKey);
    if (!col?.filter) continue;

    if (col.filter.type === "set") {
      const validValues = new Set(col.filter.values);
      const parsed = value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && validValues.has(v));
      if (parsed.length > 0) {
        result.columnFilters[accessorKey] = new Set(parsed);
      }
    } else if (col.filter.type === "range" || col.filter.type === "range-discrete") {
      const [minStr = "", maxStr = ""] = value.split(":");
      // Empty bound = unbounded on that side. For range-discrete, snap the
      // user-supplied value to the nearest allowed value (could be the same
      // thing if they picked one of the dropdown options).
      const filter = col.filter;
      const allowed = filter.type === "range-discrete" ? new Set(filter.values) : null;
      const clamp = (raw: string, fallback: number): number | null => {
        if (raw === "" || raw === undefined) return fallback;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        if (!allowed || filter.type !== "range-discrete") return n;
        // Find the closest allowed value (smallest absolute diff).
        let best: number = fallback;
        let bestDiff = Infinity;
        for (const v of filter.values) {
          const d = Math.abs(v - n);
          if (d < bestDiff) {
            bestDiff = d;
            best = v;
          }
        }
        return best;
      };
      const min = clamp(minStr, filter.min);
      const max = clamp(maxStr, filter.max);
      if (min != null && max != null && min <= max) {
        result.columnFilters[accessorKey] = [Math.max(filter.min, min), Math.min(filter.max, max)];
      }
    }
  }

  return result;
}

// Serialize view state to URLSearchParams. Omit any key whose value matches
// the default (clean URL = default view).
export function serializeState(
  state: ViewState,
  columns: Column[],
  defaultVisible: string[]
): URLSearchParams {
  const { q, sorting, visibleCols, columnFilters } = state;
  const params = new URLSearchParams();

  if (q) params.set("q", q);

  if (sorting.length > 0) {
    const s = sorting[0];
    if (s) params.set("sort", `${s.id}:${s.desc ? "desc" : "asc"}`);
  }

  if (!sameSet(visibleCols, new Set(defaultVisible))) {
    // Preserve the canonical column order so the URL is stable.
    const ordered = columns.map((c) => c.accessorKey).filter((k) => visibleCols.has(k));
    params.set("cols", ordered.join(","));
  }

  for (const col of columns) {
    const f = columnFilters[col.accessorKey];
    if (f === undefined) continue;

    if (col.filter?.type === "set" && f instanceof Set) {
      if (f.size > 0) {
        // Sort for stability (alphabetical for the values themselves).
        const ordered = col.filter.values.filter((v) => f.has(v));
        params.set(`f_${col.accessorKey}`, ordered.join(","));
      }
    } else if (
      (col.filter?.type === "range" || col.filter?.type === "range-discrete") &&
      Array.isArray(f)
    ) {
      const [lo, hi] = f;
      const filter: ColumnFilter = col.filter;
      if (filter.type === "range" || filter.type === "range-discrete") {
        const atMin = lo === filter.min;
        const atMax = hi === filter.max;
        if (!atMin || !atMax) {
          const loStr = atMin ? "" : String(lo);
          const hiStr = atMax ? "" : String(hi);
          params.set(`f_${col.accessorKey}`, `${loStr}:${hiStr}`);
        }
      }
    }
  }

  return params;
}

// Apply a URLSearchParams to window.history. No-op when the URL is unchanged.
// `replace` → replaceState (typing); otherwise pushState (deliberate actions).
export function applyToHistory(
  params: URLSearchParams,
  { replace = false }: { replace?: boolean } = {}
): void {
  if (typeof window === "undefined") return;
  const next = `?${params.toString()}`;
  const current = window.location.search;
  if (next === current) return;

  const url = `${window.location.pathname}${next}${window.location.hash}`;
  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}

// Convenience: serialize + apply in one call.
export function writeState(
  state: ViewState,
  columns: Column[],
  defaultVisible: string[],
  { replace = false }: { replace?: boolean } = {}
): void {
  const params = serializeState(state, columns, defaultVisible);
  applyToHistory(params, { replace });
}

// Re-read state from the current URL. Used by the popstate handler.
export function readState(columns: Column[], defaultVisible: string[]): ViewState {
  return parseState(window.location.search, columns, defaultVisible);
}

// Equivalence check between current state and a freshly-read state, used by
// popstate to decide whether to update React state. Two states are equivalent
// when their user-facing outputs are identical.
export function statesEqual(a: ViewState, b: ViewState): boolean {
  if (a.q !== b.q) return false;
  if (a.sorting.length !== b.sorting.length) return false;
  for (let i = 0; i < a.sorting.length; i++) {
    const sa = a.sorting[i];
    const sb = b.sorting[i];
    if (!sa || !sb) return false;
    if (sa.id !== sb.id) return false;
    if (sa.desc !== sb.desc) return false;
  }
  if (!sameSet(a.visibleCols, b.visibleCols)) return false;
  if (!sameFilters(a.columnFilters, b.columnFilters)) return false;
  return true;
}
