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
//              set   → "v1,v2,..."
//              range → "<min>:<max>" with empty bound for unbounded
//                      e.g. "2024:" = year ≥ 2024, ":2026" = year ≤ 2026

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Deep-equality for columnFilters: compare sets and tuples element-wise.
function sameFilters(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    const av = a[k];
    const bv = b[k];
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
export function parseState(searchString, columns, defaultVisible) {
  const params = new URLSearchParams(searchString);
  const result = {
    q: params.get("q") ?? "",
    sorting: [],
    visibleCols: new Set(defaultVisible),
    columnFilters: {},
  };

  // Sort
  const sort = params.get("sort");
  if (sort) {
    const [colId, dir] = sort.split(":");
    const known = columns.find((c) => c.accessorKey === colId);
    if (known && (dir === "asc" || dir === "desc")) {
      result.sorting = [{ id: colId, desc: dir === "desc" }];
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
    if (!col || !col.filter) continue;

    if (col.filter.type === "set") {
      const validValues = new Set(col.filter.values);
      const parsed = value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && validValues.has(v));
      if (parsed.length > 0) {
        result.columnFilters[accessorKey] = new Set(parsed);
      }
    } else if (col.filter.type === "range") {
      const [minStr, maxStr] = value.split(":");
      // Empty bound = unbounded on that side. Clamp to data range when present.
      const min = minStr === "" || minStr === undefined
        ? col.filter.min
        : Number(minStr);
      const max = maxStr === "" || maxStr === undefined
        ? col.filter.max
        : Number(maxStr);
      if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
        result.columnFilters[accessorKey] = [
          Math.max(col.filter.min, min),
          Math.min(col.filter.max, max),
        ];
      }
    }
  }

  return result;
}

// Serialize view state to URLSearchParams. Omit any key whose value matches
// the default (clean URL = default view).
export function serializeState({ q, sorting, visibleCols, columnFilters }, columns, defaultVisible) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);

  if (sorting.length > 0) {
    const s = sorting[0];
    params.set("sort", `${s.id}:${s.desc ? "desc" : "asc"}`);
  }

  if (!sameSet(visibleCols, new Set(defaultVisible))) {
    // Preserve the canonical column order so the URL is stable.
    const ordered = columns
      .map((c) => c.accessorKey)
      .filter((k) => visibleCols.has(k));
    params.set("cols", ordered.join(","));
  }

  for (const col of columns) {
    const f = columnFilters[col.accessorKey];
    if (f === undefined) continue;

    if (col.filter.type === "set") {
      if (f.size > 0) {
        // Sort for stability (alphabetical for the values themselves).
        const ordered = col.filter.values.filter((v) => f.has(v));
        params.set(`f_${col.accessorKey}`, ordered.join(","));
      }
    } else if (col.filter.type === "range") {
      const [lo, hi] = f;
      const atMin = lo === col.filter.min;
      const atMax = hi === col.filter.max;
      if (!atMin || !atMax) {
        const loStr = atMin ? "" : String(lo);
        const hiStr = atMax ? "" : String(hi);
        params.set(`f_${col.accessorKey}`, `${loStr}:${hiStr}`);
      }
    }
  }

  return params;
}

// Apply a URLSearchParams to window.history. No-op when the URL is unchanged.
// `replace` → replaceState (typing); otherwise pushState (deliberate actions).
export function applyToHistory(params, { replace = false } = {}) {
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
export function writeState(state, columns, defaultVisible, { replace = false } = {}) {
  const params = serializeState(state, columns, defaultVisible);
  applyToHistory(params, { replace });
}

// Re-read state from the current URL. Used by the popstate handler.
export function readState(columns, defaultVisible) {
  return parseState(window.location.search, columns, defaultVisible);
}

// Equivalence check between current state and a freshly-read state, used by
// popstate to decide whether to update React state. Two states are equivalent
// when their user-facing outputs are identical.
export function statesEqual(a, b) {
  if (a.q !== b.q) return false;
  if (a.sorting.length !== b.sorting.length) return false;
  for (let i = 0; i < a.sorting.length; i++) {
    if (a.sorting[i].id !== b.sorting[i].id) return false;
    if (a.sorting[i].desc !== b.sorting[i].desc) return false;
  }
  if (!sameSet(a.visibleCols, b.visibleCols)) return false;
  if (!sameFilters(a.columnFilters, b.columnFilters)) return false;
  return true;
}
