import { useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import chips from "./chips.json";

const fmt = (v, s = "") =>
  v === null || v === undefined ? "—" : `${v}${s}`;

// Column-level metadata. `filter` is derived per column below from the data:
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

// Sensible default visible subset (the rest are available in the Columns popover).
const DEFAULT_VISIBLE = [
  "chip",
  "generation",
  "tier",
  "year",
  "cpuCores",
  "gpuCores",
];

const TIER_COLOR = {
  Base: "#5fffb0",
  Pro: "#5fc8ff",
  Max: "#ff9f5f",
  Ultra: "#ff5fff",
};

const GEN_COLOR = {
  M1: "#999", M2: "#bbb", M3: "#5fc8ff", M4: "#5fffb0", M5: "#ff5fff",
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
  if (col.filter.type === "set") return new Set(); // empty set = no filter
  if (col.filter.type === "range") return [col.filter.min, col.filter.max];
}

function isFilterActive(col, value) {
  if (!col.filter || value === undefined) return false;
  if (col.filter.type === "set") return value.size > 0;
  if (col.filter.type === "range") return value[0] !== col.filter.min || value[1] !== col.filter.max;
  return false;
}

function FilterDialog({ col, value, onChange, onClose }) {
  // For set filters, a working copy of the Set so toggling doesn't commit until "Done".
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
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function commit(next) {
    onChange(next);
    onClose();
  }

  function commitRange() {
    const min = minStr === "" ? col.filter.min : Number(minStr);
    const max = maxStr === "" ? col.filter.max : Number(maxStr);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    commit([min, max]);
  }

  function clear() {
    commit(defaultFilterValue(col));
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-label={`Filter by ${col.header}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0a0a0a",
          border: "1px solid #1f1f1f",
          borderRadius: "5px",
          minWidth: "320px",
          maxWidth: "480px",
          padding: "1.15rem 1.3rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Filter · {col.header}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "1.2rem", padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {col.filter.type === "set" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            {col.filter.values.map((v) => {
              const checked = working.has(v);
              return (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "1rem", color: checked ? "#e8e8e8" : "#aaa" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(working);
                      if (next.has(v)) next.delete(v); else next.add(v);
                      setWorking(next);
                    }}
                    style={{ accentColor: "#5fffb0", cursor: "pointer", width: "1.05rem", height: "1.05rem" }}
                  />
                  <span style={{ textTransform: "capitalize" }}>{v}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", marginBottom: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="filter-min" style={{ display: "block", fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>Min</label>
              <input
                id="filter-min"
                type="number"
                autoFocus
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                style={{ width: "100%", background: "#0c0c0c", border: "1px solid #333", color: "#e8e8e8", padding: "0.55rem 0.7rem", fontSize: "1rem", fontFamily: "inherit", borderRadius: "3px", outline: "none" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="filter-max" style={{ display: "block", fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>Max</label>
              <input
                id="filter-max"
                type="number"
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                style={{ width: "100%", background: "#0c0c0c", border: "1px solid #333", color: "#e8e8e8", padding: "0.55rem 0.7rem", fontSize: "1rem", fontFamily: "inherit", borderRadius: "3px", outline: "none" }}
              />
            </div>
          </div>
        )}

        {col.filter.type === "range" && (
          <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>
            data range: {col.filter.min}–{col.filter.max}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={clear}
            style={{ background: "transparent", border: "1px solid #333", color: "#aaa", padding: "0.5rem 1rem", fontSize: "0.85rem", fontFamily: "inherit", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Clear
          </button>
          <button
            onClick={col.filter.type === "range" ? commitRange : () => commit(working)}
            style={{ background: "transparent", border: "1px solid #1e2e22", color: "#5fffb0", padding: "0.5rem 1rem", fontSize: "0.85rem", fontFamily: "inherit", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnsPopover({ all, visible, onToggle, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 90 }}
    >
      <div
        role="dialog"
        aria-label="Choose columns"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 70, right: 24,
          background: "#0a0a0a",
          border: "1px solid #1f1f1f",
          borderRadius: "5px",
          minWidth: "260px",
          padding: "1rem 1.15rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ fontSize: "0.8rem", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.7rem" }}>
          Columns
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {all.map((col) => (
            <label key={col.accessorKey} style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "1rem", color: visible.has(col.accessorKey) ? "#e8e8e8" : "#999" }}>
              <input
                type="checkbox"
                checked={visible.has(col.accessorKey)}
                onChange={() => onToggle(col.accessorKey)}
                style={{ accentColor: "#5fffb0", cursor: "pointer", width: "1.05rem", height: "1.05rem" }}
              />
              <span>{col.header}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppleSiliconTable() {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState([]);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const [visibleCols, setVisibleCols] = useState(() => new Set(DEFAULT_VISIBLE));
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const tableContainerRef = useRef(null);

  // Augment each column with its derived filter config (set values or range bounds).
  const COLUMNS = useMemo(() => {
    return COLUMN_DEFS.map((c) => {
      if (!c.filter) return c;
      if (c.filter.type === "set") {
        const values = Array.from(new Set(chips.map((chip) => chip[c.accessorKey]).filter((v) => v !== null && v !== undefined))).sort();
        return { ...c, filter: { type: "set", values } };
      }
      if (c.filter.type === "range") {
        const nums = chips.map((chip) => chip[c.accessorKey]).filter((v) => typeof v === "number");
        return { ...c, filter: { type: "range", min: Math.min(...nums), max: Math.max(...nums) } };
      }
      return c;
    });
  }, []);

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
          if (v === null || v === undefined) return false; // nulls excluded by range filters
          if (v < f[0] || v > f[1]) return false;
        }
      }
      return true;
    });
  }, [COLUMNS, search, columnFilters]);

  const table = useReactTable({
    data: filtered,
    columns: visibleColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const mono = "'JetBrains Mono','Fira Code','Courier New',monospace";
  const ctrl = {
    background: "#0c0c0c",
    border: "1px solid #222",
    color: "#e8e8e8",
    padding: "0.6rem 0.9rem",
    fontSize: "1rem",
    fontFamily: mono,
    borderRadius: "3px",
    outline: "none",
  };

  const activeFilterCol = activeFilterKey ? COLUMNS.find((c) => c.accessorKey === activeFilterKey) : null;

  function toggleColumn(key) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div ref={tableContainerRef} style={{ background: "#050505", minHeight: "100vh", fontFamily: mono, color: "#e8e8e8", padding: "1.5rem", fontSize: "1rem" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.5rem", borderBottom: "1px solid #181818", paddingBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>Apple Silicon</h1>
          <p style={{ fontSize: "0.95rem", color: "#777", marginTop: "0.35rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>M-Series · M1 through M5 Max</p>
        </div>
        <span style={{ fontSize: "0.95rem", color: "#666", letterSpacing: "0.06em" }}>{filtered.length} / {chips.length} chips</span>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Search</span>
        <input
          style={{ ...ctrl, width: "220px", cursor: "text" }}
          placeholder="e.g. M3 Max"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setColumnsOpen((v) => !v)}
          style={{ background: "transparent", border: "1px solid #333", color: "#ccc", padding: "0.6rem 1rem", fontSize: "0.95rem", fontFamily: mono, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          ⠿ Columns
        </button>
        <button
          onClick={() => downloadCSV(filtered)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0a1a10")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{ marginLeft: "auto", background: "transparent", border: "1px solid #1e2e22", color: "#5fffb0", padding: "0.6rem 1.1rem", fontSize: "0.95rem", fontFamily: mono, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: "5px", border: "1px solid #161616" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1rem" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const colDef = h.column.columnDef;
                  const filterActive = isFilterActive(colDef, columnFilters[colDef.accessorKey]);
                  return (
                    <th
                      key={h.id}
                      onMouseEnter={() => setHoveredCol(h.id)}
                      onMouseLeave={() => setHoveredCol(null)}
                      style={{ position: "relative", background: "#070707", color: hoveredCol === h.id ? "#5fffb0" : "#777", fontWeight: 600, padding: "0.85rem 1rem", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.9rem", borderBottom: "1px solid #161616", whiteSpace: "nowrap", userSelect: "none", transition: "color 0.15s" }}
                    >
                      <span
                        onClick={h.column.getToggleSortingHandler()}
                        style={{ cursor: h.column.getCanSort() ? "pointer" : "default" }}
                      >
                        {flexRender(colDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </span>
                      {colDef.filter && (
                        <button
                          aria-label={`Filter ${colDef.header}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterKey(colDef.accessorKey);
                          }}
                          style={{
                            marginLeft: "0.5rem",
                            background: "transparent",
                            border: "1px solid transparent",
                            color: filterActive ? "#5fffb0" : (hoveredCol === h.id ? "#5fffb0" : "#888"),
                            cursor: "pointer",
                            padding: "0 0.3rem",
                            fontSize: "1.1rem",
                            lineHeight: 1.2,
                            fontFamily: mono,
                            fontWeight: 700,
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                        >
                          ▾
                        </button>
                      )}
                      {hoveredCol === h.id && colDef.description && (
                        <div
                          role="tooltip"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            zIndex: 10,
                            maxWidth: "320px",
                            minWidth: "180px",
                            padding: "0.65rem 0.85rem",
                            background: "#0a0a0a",
                            border: "1px solid #1f1f1f",
                            borderRadius: "3px",
                            color: "#d8d8d8",
                            textTransform: "none",
                            letterSpacing: "0",
                            fontWeight: 400,
                            fontSize: "0.95rem",
                            lineHeight: 1.45,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                            pointerEvents: "none",
                          }}
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
                <td colSpan={visibleColumns.length} style={{ textAlign: "center", color: "#555", padding: "3rem", letterSpacing: "0.12em", fontSize: "1rem" }}>
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
                    style={{ background: hoveredRow === i ? "#111" : i % 2 === 0 ? "#060606" : "#090909", transition: "background 0.1s" }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const col = cell.column.id;
                      const val = cell.getValue();
                      let content;
                      if (col === "chip") {
                        content = <span style={{ fontFamily: mono, fontWeight: 700, color: "#ffffff", letterSpacing: "0.03em" }}>{val}</span>;
                      } else if (col === "tier") {
                        const c = TIER_COLOR[tier] ?? "#888";
                        content = <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "3px", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, border: `1px solid ${c}44`, color: c, background: `${c}15` }}>{val}</span>;
                      } else if (col === "generation") {
                        content = <span style={{ color: GEN_COLOR[gen] ?? "#bbb", fontWeight: 600 }}>{val}</span>;
                      } else if (col === "thunderbolt") {
                        const tbColor = val === "TB5" ? "#ff9f5f" : val === "TB4" ? "#5fc8ff" : "#aaa";
                        content = <span style={{ color: tbColor, fontWeight: 600 }}>{val}</span>;
                      } else {
                        content = <span style={{ color: val === null || val === undefined ? "#555" : "#d0d0d0" }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>;
                      }
                      return (
                        <td key={cell.id} style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #0e0e0e", whiteSpace: "nowrap" }}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "0.85rem", fontSize: "0.85rem", color: "#888", letterSpacing: 0 }}>
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
