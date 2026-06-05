import { describe, it, expect } from "vitest";
import { summarizeState, buildTitle } from "../summarize.js";

const COLUMNS = [
  { accessorKey: "chip", header: "Chip" },
  { accessorKey: "generation", header: "Gen", filter: { type: "set", values: ["M1", "M2", "M3", "M4", "M5"] } },
  { accessorKey: "tier", header: "Tier", filter: { type: "set", values: ["Base", "Pro", "Max", "Ultra"] } },
  { accessorKey: "year", header: "Year", filter: { type: "range", min: 2020, max: 2026 } },
  { accessorKey: "cpuCores", header: "CPU Cores", filter: { type: "range", min: 8, max: 32 } },
  { accessorKey: "thunderbolt", header: "TB", filter: { type: "set", values: ["TB3", "TB4", "TB5"] } },
  { accessorKey: "processNode", header: "Process" },
  { accessorKey: "gpuCores", header: "GPU Cores", filter: { type: "range", min: 8, max: 80 } },
];

const DEFAULT_VISIBLE = ["chip", "generation", "tier", "year"];

function stateOf(overrides) {
  return {
    q: "",
    sorting: [],
    visibleCols: new Set(DEFAULT_VISIBLE),
    columnFilters: {},
    ...overrides,
  };
}

describe("summarizeState — default view", () => {
  it("returns an 'All N chips' fragment when no state is set", () => {
    const out = summarizeState(stateOf({}), COLUMNS, DEFAULT_VISIBLE, 18);
    expect(out).toEqual([{ kind: "default", text: "All 18 chips" }]);
  });

  it("falls back to 'All chips' when totalCount is omitted", () => {
    const out = summarizeState(stateOf({}), COLUMNS, DEFAULT_VISIBLE);
    expect(out).toEqual([{ kind: "default", text: "All chips" }]);
  });
});

describe("summarizeState — search", () => {
  it("includes the search query", () => {
    const out = summarizeState(stateOf({ q: "M3 Max" }), COLUMNS, DEFAULT_VISIBLE);
    expect(out).toContainEqual({ kind: "search", text: 'matching "M3 Max"' });
  });
});

describe("summarizeState — set filters", () => {
  it("includes a single-value set filter", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { tier: new Set(["Max"]) } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "tier", text: "Max tier" });
  });

  it("uses 'or' between multi-value set filters", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { tier: new Set(["Max", "Ultra"]) } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "tier", text: "Max or Ultra tier" });
  });
});

describe("summarizeState — range filters", () => {
  it("lower-unbounded range says 'X or later'", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { year: [2024, 2026] } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "year", text: "year 2024 or later" });
  });

  it("upper-unbounded range says 'X or less'", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { year: [2020, 2024] } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "year", text: "year 2024 or less" });
  });

  it("fully-bounded range uses an en-dash", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { year: [2023, 2025] } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "year", text: "year 2023–2025" });
  });

  it("omits a range filter at the data bounds (default)", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { year: [2020, 2026] } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out.filter((f) => f.kind === "filter")).toEqual([]);
  });

  it("formats float ranges with one decimal", () => {
    const out = summarizeState(
      stateOf({ columnFilters: { year: [2023.5, 2025.5] } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "filter", key: "year", text: "year 2023.5–2025.5" });
  });
});

describe("summarizeState — sort", () => {
  it("includes ascending sort with an up arrow", () => {
    const out = summarizeState(
      stateOf({ sorting: [{ id: "year", desc: false }] }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "sort", text: "sorted by year ↑" });
  });

  it("includes descending sort with a down arrow", () => {
    const out = summarizeState(
      stateOf({ sorting: [{ id: "year", desc: true }] }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "sort", text: "sorted by year ↓" });
  });
});

describe("summarizeState — visible columns differ from default", () => {
  it("shows '+N more' when extra columns are visible", () => {
    const out = summarizeState(
      stateOf({ visibleCols: new Set([...DEFAULT_VISIBLE, "processNode", "gpuCores"]) }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out).toContainEqual({ kind: "cols", text: "+2 more" });
  });

  it("does not flag when only the default columns are visible", () => {
    const out = summarizeState(
      stateOf({ visibleCols: new Set(DEFAULT_VISIBLE) }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(out.filter((f) => f.kind === "cols")).toEqual([]);
  });
});

describe("summarizeState — order", () => {
  it("search → filters → sort, in that order", () => {
    const out = summarizeState(
      stateOf({
        q: "Pro",
        columnFilters: { tier: new Set(["Max"]) },
        sorting: [{ id: "year", desc: true }],
      }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    const kinds = out.map((f) => f.kind);
    expect(kinds).toEqual(["search", "filter", "sort"]);
  });
});

describe("buildTitle — default view", () => {
  it("returns the base title when no state is set", () => {
    const title = buildTitle(stateOf({}), COLUMNS, DEFAULT_VISIBLE, 18);
    expect(title).toBe("Apple Silicon · M-Series Comparison");
  });
});

describe("buildTitle — single filter", () => {
  it("appends a set filter value and the count", () => {
    const title = buildTitle(
      stateOf({ columnFilters: { tier: new Set(["Max"]) } }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      5
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · Max (5/18)");
  });

  it("appends a lower-unbounded range", () => {
    const title = buildTitle(
      stateOf({ columnFilters: { year: [2024, 2026] } }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      7
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · 2024 or later (7/18)");
  });

  it("appends an upper-unbounded range", () => {
    const title = buildTitle(
      stateOf({ columnFilters: { year: [2020, 2024] } }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      12
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · 2024 or less (12/18)");
  });
});

describe("buildTitle — search + filter", () => {
  it("puts search first, then the filter, then the count", () => {
    const title = buildTitle(
      stateOf({
        q: "M3",
        columnFilters: { tier: new Set(["Max"]) },
      }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      1
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · M3 · Max (1/18)");
  });
});

describe("buildTitle — multi-value set filter", () => {
  it("joins values with a comma", () => {
    const title = buildTitle(
      stateOf({ columnFilters: { tier: new Set(["Max", "Ultra"]) } }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      6
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · Max, Ultra (6/18)");
  });
});

describe("buildTitle — sort is omitted", () => {
  it("does not include sort in the title", () => {
    const title = buildTitle(
      stateOf({
        columnFilters: { tier: new Set(["Max"]) },
        sorting: [{ id: "year", desc: true }],
      }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      5
    );
    expect(title).not.toContain("sorted");
    expect(title).not.toContain("↓");
  });
});

describe("buildTitle — truncation", () => {
  it("truncates a long title with an ellipsis", () => {
    // Build a state with a very long search query that would blow past 80 chars.
    const longQ = "M3 Max with 38 GPU cores and 192 GB RAM";
    const title = buildTitle(
      stateOf({ q: longQ }),
      COLUMNS,
      DEFAULT_VISIBLE,
      18,
      1
    );
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toMatch(/…/);
  });
});

describe("buildTitle — count is optional", () => {
  it("omits the count when totalCount is not provided", () => {
    const title = buildTitle(
      stateOf({ columnFilters: { tier: new Set(["Max"]) } }),
      COLUMNS,
      DEFAULT_VISIBLE
    );
    expect(title).toBe("Apple Silicon · M-Series Comparison · Max");
  });
});
