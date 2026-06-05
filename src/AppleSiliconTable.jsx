import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePostHog } from "@posthog/react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import chips from "./chips.json";
import { parseState, writeState, readState, statesEqual } from "./urlState.js";
import { summarizeState } from "./summarize.js";

const fmt = (v, s = "") =>
  v === null || v === undefined ? "—" : `${v}${s}`;

// Per-column metadata. `filter` is derived per column below from the data:
//   - omitted         -> no filter (chip, processNode, etc.)
//   - { type: "set" } -> checkbox list of unique values
//   - { type: "range" }-> min/max number inputs, bounded by data min/max
const COLUMN_DEFS = [
  { accessorKey: "chip", header: "Chip", description: "Official Apple marketing name of the chip (e.g. M3 Pro, M4 Max)." },
  { accessorKey: "generation", header: "Gen", description: "Apple silicon generation: M1, M2, M3, M4, or M5.", filter: { type: "set" } },
  { accessorKey: "tier", header: "Tier", description: "Performance tier within a generation: Base, Pro, Max, or Ultra.", filter: { type: "set" } },
  { accessorKey: "year", header: "Year", description: "Year the chip was announced or first shipped in a Mac.", filter: { type: "range" } },
  { accessorKey: "processNode", header: "Process", description: "TSMC fabrication process node (e.g. 5nm, 3nm). Smaller is newer and more efficient." },
  { accessorKey: "cpuCores", header: "CPU Cores", description: "Total CPU cores = performance cores + efficiency cores.", filter: { type: "range" }, cell: (i) => fmt(i.getValue()) },
  { accessorKey: "perfCores", header: "Perf", description: "High-performance CPU cores used for demanding single-threaded work.", filter: { type: "range" }, cell: (i) => fmt(i.getValue()) },
  { accessorKey: "efficiencyCores", header: "Eff", description: "High-efficiency CPU cores used for background and low-power tasks.", filter: { type: "range" }, cell: (i) => fmt(i.getValue()) },
  { accessorKey: "gpuCores", header: "GPU Cores", description: "Number of GPU cores. More cores = more graphics and parallel compute throughput.", filter: { type: "range" }, cell: (i) => fmt(i.getValue()) },
  { accessorKey: "neuralEngineCores", header: "NE Cores", description: "Number of cores in the Neural Engine, Apple's ML accelerator.", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "neuralEngineTOPS", header: "TOPS", description: "Neural Engine throughput in tera-operations per second. Higher = faster on-device ML.", filter: { type: "range" }, cell: (i) => fmt(i.getValue()) },
  { accessorKey: "maxUnifiedMemoryGB", header: "Max RAM", description: "Maximum configurable unified memory, shared between CPU, GPU, and Neural Engine.", cell: (i) => fmt(i.getValue(), " GB") },
  { accessorKey: "memoryBandwidthGBs", header: "Bandwidth", description: "Peak unified memory bandwidth in GB/s. Higher bandwidth reduces memory-bound bottlenecks.", cell: (i) => fmt(i.getValue(), " GB/s") },
  { accessorKey: "transistorsBillions", header: "Transistors", description: "Total transistor count in billions. A rough proxy for die complexity and capability.", cell: (i) => fmt(i.getValue(), "B") },
  { accessorKey: "thunderbolt", header: "TB", description: "Thunderbolt generation supported. TB4 = 40 Gb/s, TB5 = 80 Gb/s.", filter: { type: "set" } },
];

// Default visible subset. The rest are available in the Columns popover.
const DEFAULT_VISIBLE = [
  "chip",
  "generation",
  "tier",
  "year",
  "cpuCores",
  "gpuCores",
];

// Map tier to a daisyUI badge variant.
const TIER_BADGE = {
  Base: "badge-success",
  Pro: "badge-info",
  Max: "badge-warning",
  Ultra: "badge-secondary",
};

// Augment each column with its derived filter config. Computed once at module
// load (chips.json is a static import) so it's available before any component
// renders — including lazy useState initializers that read the URL.
const COLUMNS = COLUMN_DEFS.map((c) => {
  if (!c.filter) return c;
  if (c.filter.type === "set") {
    const values = Array.from(
      new Set(chips.map((chip) => chip[c.accessorKey]).filter((v) => v !== null && v !== undefined))
    ).sort();
    return { ...c, filter: { type: "set", values } };
  }
  if (c.filter.type === "range") {
    const nums = chips.map((chip) => chip[c.accessorKey]).filter((v) => typeof v === "number");
    return { ...c, filter: { type: "range", min: Math.min(...nums), max: Math.max(...nums) } };
  }
  return c;
});

// Subtle per-generation text tint (kept inline because it's data, not theme).
const GEN_COLOR = {
  M1: "#999", M2: "#bbb", M3: "#5fc8ff", M4: "#5fffb0", M5: "#ff5fff",
};
const TB_COLOR = {
  TB3: "#aaa",
  TB4: "#5fc8ff",
  TB5: "#ff9f5f",
};

function downloadCSV(data) {
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map((row) =>
      keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return "N/A";
        const s = String(v);
        return s.includes(",") ? `"${s}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: "apple-silicon-chips.csv",
  });
  a.click();
}

// Default per-column filter state (means "no filter applied").
function defaultFilterValue(col) {
  if (!col.filter) return undefined;
  if (col.filter.type === "set") return new Set();
  if (col.filter.type === "range") return [col.filter.min, col.filter.max];
}

function isFilterActive(col, value) {
  if (!col.filter || value === undefined) return false;
  if (col.filter.type === "set") return value.size > 0;
  if (col.filter.type === "range") return value[0] !== col.filter.min || value[1] !== col.filter.max;
  return false;
}

function FilterDialog({ col, value, onChange, onClose }) {
  const dialogRef = useRef(null);
  const posthog = usePostHog();
  const [working, setWorking] = useState(
    col.filter.type === "set" ? (value ?? defaultFilterValue(col)) : null
  );
  // String mirrors of the range inputs so the user can leave them empty while typing.
  const [minStr, setMinStr] = useState(
    col.filter.type === "range" ? String((value ?? defaultFilterValue(col))[0]) : ""
  );
  const [maxStr, setMaxStr] = useState(
    col.filter.type === "range" ? String((value ?? defaultFilterValue(col))[1]) : ""
  );

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    const handleClose = () => onClose();
    dlg.addEventListener("close", handleClose);
    // jsdom doesn't fire a cancel event on Esc; real browsers do. Belt and
    // suspenders: also call close() explicitly on Esc, idempotent in either env.
    const handleKey = (e) => { if (e.key === "Escape" && dlg.open) dlg.close(); };
    document.addEventListener("keydown", handleKey);
    return () => {
      dlg.removeEventListener("close", handleClose);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function commit(next) {
    onChange(next);
    posthog?.capture("column_filter_applied", {
      column_key: col.accessorKey,
      filter_type: col.filter.type,
    });
    onClose();
  }

  function commitRange() {
    const min = minStr === "" ? col.filter.min : Number(minStr);
    const max = maxStr === "" ? col.filter.max : Number(maxStr);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    commit([min, max]);
  }

  function clear() {
    onChange(defaultFilterValue(col));
    posthog?.capture("column_filter_cleared", { column_key: col.accessorKey });
    onClose();
  }

  return (
    <dialog ref={dialogRef} aria-label={`Filter by ${col.header}`} className="modal">
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-widest text-base-content/60">
            Filter · {col.header}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-sm btn-ghost btn-square"
          >
            ✕
          </button>
        </div>

        {col.filter.type === "set" ? (
          <div className="flex flex-col gap-2 mb-4">
            {col.filter.values.map((v) => {
              const checked = working.has(v);
              return (
                <label key={v} className="label cursor-pointer gap-3 justify-start py-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(working);
                      if (next.has(v)) next.delete(v); else next.add(v);
                      setWorking(next);
                    }}
                    className="checkbox checkbox-sm checkbox-success"
                  />
                  <span className="label-text capitalize">{v}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-1">
              <div className="flex-1">
                <label htmlFor="filter-min" className="block text-xs uppercase tracking-widest text-base-content/60 mb-1">
                  Min
                </label>
                <input
                  id="filter-min"
                  type="number"
                  autoFocus
                  value={minStr}
                  onChange={(e) => setMinStr(e.target.value)}
                  className="input input-bordered input-sm w-full font-mono"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="filter-max" className="block text-xs uppercase tracking-widest text-base-content/60 mb-1">
                  Max
                </label>
                <input
                  id="filter-max"
                  type="number"
                  value={maxStr}
                  onChange={(e) => setMaxStr(e.target.value)}
                  className="input input-bordered input-sm w-full font-mono"
                />
              </div>
            </div>
            <div className="text-xs text-base-content/50 mb-3">
              data range: {col.filter.min}–{col.filter.max}
            </div>
          </>
        )}

        <div className="modal-action mt-2">
          <button type="button" onClick={clear} className="btn btn-sm btn-ghost">
            Clear
          </button>
          <button
            type="button"
            onClick={col.filter.type === "range" ? commitRange : () => commit(working)}
            className="btn btn-sm btn-success"
          >
            Done
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

function ColumnsPopover({ all, visible, onToggle, onClose }) {
  const ref = useRef(null);
  const posthog = usePostHog();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    const handleClose = () => onClose();
    const handleKey = (e) => { if (e.key === "Escape" && dlg.open) dlg.close(); };
    dlg.addEventListener("close", handleClose);
    document.addEventListener("keydown", handleKey);
    return () => {
      dlg.removeEventListener("close", handleClose);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <dialog ref={ref} aria-label="Choose columns" className="modal">
      <div className="modal-box max-w-xs p-4">
        <div className="text-xs uppercase tracking-widest text-base-content/60 mb-3">
          Columns
        </div>
        <div className="flex flex-col gap-2">
          {all.map((col) => (
            <label key={col.accessorKey} className="label cursor-pointer gap-3 justify-start py-1">
              <input
                type="checkbox"
                checked={visible.has(col.accessorKey)}
                onChange={() => {
                  posthog?.capture("column_visibility_toggled", {
                    column_key: col.accessorKey,
                    visible: !visible.has(col.accessorKey),
                  });
                  onToggle(col.accessorKey);
                }}
                className="checkbox checkbox-sm checkbox-success"
              />
              <span className="label-text">{col.header}</span>
            </label>
          ))}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

export default function AppleSiliconTable() {
  const posthog = usePostHog();

  // All view state is hydrated from the URL on first render. Subsequent
  // changes flow state → URL via useEffect, and URL → state via popstate.
  const [search, setSearch] = useState(() => parseState(window.location.search, COLUMNS, DEFAULT_VISIBLE).q);
  const [sorting, setSorting] = useState(() => parseState(window.location.search, COLUMNS, DEFAULT_VISIBLE).sorting);
  const [visibleCols, setVisibleCols] = useState(
    () => parseState(window.location.search, COLUMNS, DEFAULT_VISIBLE).visibleCols
  );
  const [columnFilters, setColumnFilters] = useState(
    () => parseState(window.location.search, COLUMNS, DEFAULT_VISIBLE).columnFilters
  );
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Mark the most recent state change so the URL-sync effect knows whether
  // to replaceState (search) or pushState (everything else). Reset by the
  // effect on every commit.
  const nextWriteReplace = useRef(false);

  // Mirror state → URL on every change. The setSearch wrapper below flips
  // the ref to true for typing so the effect uses replaceState.
  useEffect(() => {
    // Skip the very first render — initial state came from the URL, so the
    // URL already matches. (Calling writeState here would no-op anyway via
    // applyToHistory's equality check, but skipping avoids a needless call.)
    const state = { q: search, sorting, visibleCols, columnFilters };
    const fromUrl = parseState(window.location.search, COLUMNS, DEFAULT_VISIBLE);
    if (statesEqual(state, fromUrl)) {
      nextWriteReplace.current = false;
      return;
    }
    writeState(state, COLUMNS, DEFAULT_VISIBLE, { replace: nextWriteReplace.current });
    nextWriteReplace.current = false;
  }, [search, sorting, visibleCols, columnFilters]);

  // Wrap setSearch so the URL-sync effect uses replaceState (typing is
  // continuous, no need for a history entry per keystroke). Other setters
  // default to pushState.
  const setSearchReplace = useCallback((v) => {
    nextWriteReplace.current = true;
    setSearch(v);
  }, []);

  // Listen for browser back/forward — re-read state from URL. React's
  // setters are stable identities, and the handler reads `next` from the
  // URL at pop time, so the effect can run once on mount.
  useEffect(() => {
    function onPopState() {
      const next = readState(COLUMNS, DEFAULT_VISIBLE);
      setSearch(next.q);
      setSorting(next.sorting);
      setVisibleCols(next.visibleCols);
      setColumnFilters(next.columnFilters);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // "Reset" link is shown when any view state differs from defaults. Clicking
  // it clears all state and navigates to the bare path.
  const hasNonDefaultState = useMemo(() => {
    if (search) return true;
    if (sorting.length > 0) return true;
    if (visibleCols.size !== DEFAULT_VISIBLE.length) return true;
    for (const k of DEFAULT_VISIBLE) if (!visibleCols.has(k)) return true;
    if (Object.keys(columnFilters).length > 0) return true;
    return false;
  }, [search, sorting, visibleCols, columnFilters]);

  function resetToDefault() {
    setSearch("");
    setSorting([]);
    setVisibleCols(new Set(DEFAULT_VISIBLE));
    setColumnFilters({});
    // Push the clean URL so the back button doesn't return to the filtered view.
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", window.location.pathname);
    }
  }

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => visibleCols.has(c.accessorKey)),
    [COLUMNS, visibleCols]
  );

  const filtered = useMemo(() => {
    return chips.filter((c) => {
      if (search && !c.chip.toLowerCase().includes(search.toLowerCase())) return false;
      for (const col of COLUMNS) {
        const f = columnFilters[col.accessorKey];
        if (f === undefined) continue;
        if (col.filter?.type === "set") {
          if (f.size > 0 && !f.has(c[col.accessorKey])) return false;
        } else if (col.filter?.type === "range") {
          const v = c[col.accessorKey];
          if (v === null || v === undefined) return false;
          if (v < f[0] || v > f[1]) return false;
        }
      }
      return true;
    });
  }, [COLUMNS, search, columnFilters]);

  function handleSortingChange(updater) {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
    if (next.length > 0) {
      posthog?.capture("column_sorted", {
        column_key: next[0].id,
        sort_direction: next[0].desc ? "desc" : "asc",
      });
    }
  }

  const table = useReactTable({
    data: filtered,
    columns: visibleColumns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const activeFilterCol = activeFilterKey ? COLUMNS.find((c) => c.accessorKey === activeFilterKey) : null;

  // Human-readable summary of the current view state (what the filters,
  // search, sort, and visible columns are doing). Replaces the static
  // subtitle so a shared link is understandable at a glance.
  const summary = useMemo(
    () => summarizeState(
      { q: search, sorting, visibleCols, columnFilters },
      COLUMNS,
      DEFAULT_VISIBLE,
      chips.length
    ),
    [search, sorting, visibleCols, columnFilters]
  );

  function toggleColumn(key) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content p-6 font-mono">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 border-b border-base-300 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Apple Silicon</h1>
          <p className="text-sm text-base-content/60 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {summary.map((frag, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-base-content/30">·</span>}
                <span>{frag.text}</span>
              </span>
            ))}
          </p>
        </div>
        <span className="text-sm text-base-content/60">
          {filtered.length} / {chips.length} chips
        </span>
        {hasNonDefaultState && (
          <button
            type="button"
            onClick={resetToDefault}
            className="text-sm text-base-content/60 hover:text-base-content underline underline-offset-2 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-xs text-base-content/60 uppercase tracking-widest">Search</span>
        <input
          className="input input-bordered input-sm w-56 font-mono"
          placeholder="e.g. M3 Max"
          value={search}
          onChange={(e) => {
            setSearchReplace(e.target.value);
            if (e.target.value) {
              posthog?.capture("chip_searched", { query: e.target.value });
            }
          }}
        />
        <button
          type="button"
          onClick={() => setColumnsOpen(true)}
          className="btn btn-sm btn-ghost"
        >
          ⠿ Columns
        </button>
        <button
          type="button"
          onClick={() => {
            downloadCSV(filtered);
            posthog?.capture("csv_exported", { chip_count: filtered.length });
          }}
          className="btn btn-sm btn-success btn-outline ml-auto"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-zebra table-pin-rows">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-base-200">
                {hg.headers.map((h) => {
                  const colDef = h.column.columnDef;
                  const filterActive = isFilterActive(colDef, columnFilters[colDef.accessorKey]);
                  return (
                    <th
                      key={h.id}
                      onMouseEnter={() => setHoveredCol(h.id)}
                      onMouseLeave={() => setHoveredCol(null)}
                      className="relative text-xs uppercase tracking-widest text-base-content/70 font-semibold select-none"
                    >
                      <span
                        onClick={h.column.getToggleSortingHandler()}
                        className={h.column.getCanSort() ? "cursor-pointer" : "cursor-default"}
                      >
                        {flexRender(colDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </span>
                      {colDef.filter && (
                        <button
                          type="button"
                          aria-label={`Filter ${colDef.header}`}
                          onClick={() => setActiveFilterKey(colDef.accessorKey)}
                          className={`btn btn-xs btn-ghost btn-square ml-1 ${filterActive ? "text-success" : "text-base-content/60"}`}
                        >
                          ▾
                        </button>
                      )}
                      {hoveredCol === h.id && colDef.description && (
                        <div
                          role="tooltip"
                          className="absolute bottom-full left-0 z-20 mb-1.5 max-w-xs min-w-44 px-3 py-2 bg-base-200 border border-base-300 rounded text-sm normal-case tracking-normal font-normal leading-snug shadow-lg pointer-events-none"
                        >
                          {colDef.description}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="py-12 text-center text-base-content/40 uppercase tracking-widest"
                >
                  NO CHIPS MATCH YOUR FILTERS
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => {
                const tier = row.original.tier;
                const gen = row.original.generation;
                return (
                  <tr
                    key={row.id}
                    className={`hover transition-colors ${hoveredRow === i ? "bg-base-200" : ""}`}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const col = cell.column.id;
                      const val = cell.getValue();
                      let content;
                      if (col === "chip") {
                        content = <span className="font-bold text-base-content tracking-wide">{val}</span>;
                      } else if (col === "tier") {
                        const variant = TIER_BADGE[tier] ?? "badge-ghost";
                        content = <span className={`badge badge-md ${variant} badge-soft font-semibold`}>{val}</span>;
                      } else if (col === "generation") {
                        content = <span className="font-semibold" style={{ color: GEN_COLOR[gen] ?? undefined }}>{val}</span>;
                      } else if (col === "thunderbolt") {
                        content = <span className="font-semibold" style={{ color: TB_COLOR[val] ?? undefined }}>{val}</span>;
                      } else {
                        content = (
                          <span className={val === null || val === undefined ? "text-base-content/30" : "text-base-content/80"}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        );
                      }
                      return <td key={cell.id} className="whitespace-nowrap">{content}</td>;
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-base-content/50">
        Click a column header to sort · Click ▾ on a column to filter · Pick columns to show from the top bar
      </div>

      {activeFilterCol && (
        <FilterDialog
          col={activeFilterCol}
          value={columnFilters[activeFilterCol.accessorKey]}
          onChange={(next) => setColumnFilters((prev) => ({ ...prev, [activeFilterCol.accessorKey]: next }))}
          onClose={() => setActiveFilterKey(null)}
        />
      )}

      {columnsOpen && (
        <ColumnsPopover
          all={COLUMNS}
          visible={visibleCols}
          onToggle={toggleColumn}
          onClose={() => setColumnsOpen(false)}
        />
      )}
    </div>
  );
}
