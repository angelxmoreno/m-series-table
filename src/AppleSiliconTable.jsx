import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import chips from "./chips.json";

const GENERATIONS = ["All", "M1", "M2", "M3", "M4", "M5"];
const TIERS = ["All", "Base", "Pro", "Max", "Ultra"];

const fmt = (v, s = "") =>
  v === null || v === undefined ? "—" : `${v}${s}`;

const COLUMNS = [
  { accessorKey: "chip", header: "Chip" },
  { accessorKey: "generation", header: "Gen" },
  { accessorKey: "tier", header: "Tier" },
  { accessorKey: "year", header: "Year" },
  { accessorKey: "processNode", header: "Process" },
  { accessorKey: "cpuCores", header: "CPU Cores", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "perfCores", header: "Perf", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "efficiencyCores", header: "Eff", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "gpuCores", header: "GPU Cores", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "neuralEngineCores", header: "NE Cores", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "neuralEngineTOPS", header: "TOPS", cell: (i) => fmt(i.getValue()) },
  { accessorKey: "maxUnifiedMemoryGB", header: "Max RAM", cell: (i) => fmt(i.getValue(), " GB") },
  { accessorKey: "memoryBandwidthGBs", header: "Bandwidth", cell: (i) => fmt(i.getValue(), " GB/s") },
  { accessorKey: "transistorsBillions", header: "Transistors", cell: (i) => fmt(i.getValue(), "B") },
  { accessorKey: "thunderbolt", header: "TB" },
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

export default function AppleSiliconTable() {
  const [genFilter, setGenFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState([]);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const filtered = useMemo(
    () =>
      chips.filter(
        (c) =>
          (genFilter === "All" || c.generation === genFilter) &&
          (tierFilter === "All" || c.tier === tierFilter) &&
          (search === "" || c.chip.toLowerCase().includes(search.toLowerCase()))
      ),
    [genFilter, tierFilter, search]
  );

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
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
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
    fontFamily: mono,
    borderRadius: "3px",
    outline: "none",
  };

  return (
    <div style={{ background: "#050505", minHeight: "100vh", fontFamily: mono, color: "#e8e8e8", padding: "1.5rem" }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.5rem", borderBottom: "1px solid #181818", paddingBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>Apple Silicon</h1>
          <p style={{ fontSize: "0.8rem", color: "#555", marginTop: "0.35rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>M-Series · M1 through M5 Max</p>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#444", letterSpacing: "0.06em" }}>{filtered.length} / {chips.length} chips</span>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>Search</span>
        <input style={{ ...ctrl, width: "170px", cursor: "text" }} placeholder="e.g. M3 Max" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span style={{ fontSize: "0.75rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gen</span>
        <select style={{ ...ctrl, cursor: "pointer" }} value={genFilter} onChange={(e) => setGenFilter(e.target.value)}>
          {GENERATIONS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <span style={{ fontSize: "0.75rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>Tier</span>
        <select style={{ ...ctrl, cursor: "pointer" }} value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          {TIERS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={() => downloadCSV(filtered)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0a1a10")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{ marginLeft: "auto", background: "transparent", border: "1px solid #1e2e22", color: "#5fffb0", padding: "0.5rem 1rem", fontSize: "0.85rem", fontFamily: mono, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: "5px", border: "1px solid #161616" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    onMouseEnter={() => setHoveredCol(h.id)}
                    onMouseLeave={() => setHoveredCol(null)}
                    style={{ background: "#070707", color: hoveredCol === h.id ? "#5fffb0" : "#444", fontWeight: 600, padding: "0.65rem 0.9rem", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.7rem", borderBottom: "1px solid #161616", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", transition: "color 0.15s" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: "center", color: "#2a2a2a", padding: "3rem", letterSpacing: "0.12em", fontSize: "0.85rem" }}>
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
                        content = <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "3px", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, border: `1px solid ${c}44`, color: c, background: `${c}15` }}>{val}</span>;
                      } else if (col === "generation") {
                        content = <span style={{ color: GEN_COLOR[gen] ?? "#bbb", fontWeight: 600 }}>{val}</span>;
                      } else if (col === "thunderbolt") {
                        const tbColor = val === "TB5" ? "#ff9f5f" : val === "TB4" ? "#5fc8ff" : "#aaa";
                        content = <span style={{ color: tbColor, fontWeight: 600 }}>{val}</span>;
                      } else {
                        content = <span style={{ color: val === null || val === undefined ? "#333" : "#d0d0d0" }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>;
                      }
                      return (
                        <td key={cell.id} style={{ padding: "0.6rem 0.9rem", borderBottom: "1px solid #0e0e0e", whiteSpace: "nowrap" }}>
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

      <div style={{ marginTop: "0.85rem", fontSize: "0.72rem", color: "#2e2e2e", letterSpacing: "0.08em" }}>
        Click any column header to sort · Filter by generation or tier · Export exports the current filtered view
      </div>
    </div>
  );
}
