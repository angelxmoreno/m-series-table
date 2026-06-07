import { describe, it, expect } from "vitest";
import {
  parseState,
  serializeState,
  applyToHistory,
  statesEqual,
} from "./urlState.js";

// Minimal stub matching the augmented column shape AppleSiliconTable produces.
// We test urlState in isolation — no need to load the real chips.json.
const COLUMNS = [
  { accessorKey: "chip", header: "Chip" },
  { accessorKey: "generation", header: "Gen", filter: { type: "set", values: ["M1", "M2", "M3", "M4", "M5"] } },
  { accessorKey: "tier", header: "Tier", filter: { type: "set", values: ["Base", "Pro", "Max", "Ultra"] } },
  { accessorKey: "year", header: "Year", filter: { type: "range", min: 2020, max: 2026 } },
  { accessorKey: "cpuCores", header: "CPU Cores", filter: { type: "range", min: 8, max: 32 } },
  { accessorKey: "thunderbolt", header: "TB", filter: { type: "set", values: ["TB3", "TB4", "TB5"] } },
];

const DEFAULT_VISIBLE = ["chip", "generation", "tier", "year", "cpuCores"];

describe("parseState — empty/default", () => {
  it("returns defaults for empty search string", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    expect(s.q).toBe("");
    expect(s.sorting).toEqual([]);
    expect([...s.visibleCols]).toEqual(DEFAULT_VISIBLE);
    expect(s.columnFilters).toEqual({});
  });

  it("returns defaults when search string is just a ?", () => {
    const s = parseState("?", COLUMNS, DEFAULT_VISIBLE);
    expect(s.q).toBe("");
    expect(s.sorting).toEqual([]);
  });
});

describe("parseState — search", () => {
  it("reads q", () => {
    const s = parseState("?q=M3+Max", COLUMNS, DEFAULT_VISIBLE);
    expect(s.q).toBe("M3 Max");
  });
});

describe("parseState — sort", () => {
  it("reads sort asc", () => {
    const s = parseState("?sort=year:asc", COLUMNS, DEFAULT_VISIBLE);
    expect(s.sorting).toEqual([{ id: "year", desc: false }]);
  });

  it("reads sort desc", () => {
    const s = parseState("?sort=year:desc", COLUMNS, DEFAULT_VISIBLE);
    expect(s.sorting).toEqual([{ id: "year", desc: true }]);
  });

  it("ignores unknown column id", () => {
    const s = parseState("?sort=bogus:asc", COLUMNS, DEFAULT_VISIBLE);
    expect(s.sorting).toEqual([]);
  });

  it("ignores invalid direction", () => {
    const s = parseState("?sort=year:sideways", COLUMNS, DEFAULT_VISIBLE);
    expect(s.sorting).toEqual([]);
  });
});

describe("parseState — visible columns", () => {
  it("reads a custom cols list", () => {
    const s = parseState("?cols=chip,tier,thunderbolt", COLUMNS, DEFAULT_VISIBLE);
    expect([...s.visibleCols]).toEqual(["chip", "tier", "thunderbolt"]);
  });

  it("falls back to defaults when every key is invalid", () => {
    const s = parseState("?cols=bogus,nope", COLUMNS, DEFAULT_VISIBLE);
    expect([...s.visibleCols]).toEqual(DEFAULT_VISIBLE);
  });

  it("drops invalid keys but keeps valid ones", () => {
    const s = parseState("?cols=chip,bogus,thunderbolt", COLUMNS, DEFAULT_VISIBLE);
    expect([...s.visibleCols]).toEqual(["chip", "thunderbolt"]);
  });
});

describe("parseState — set filters", () => {
  it("reads a single-value set filter", () => {
    const s = parseState("?f_generation=M4", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.generation).toEqual(new Set(["M4"]));
  });

  it("reads a multi-value set filter", () => {
    const s = parseState("?f_generation=M3,M4", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.generation).toEqual(new Set(["M3", "M4"]));
  });

  it("ignores values not in the column's allowed set", () => {
    const s = parseState("?f_generation=M3,M99", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.generation).toEqual(new Set(["M3"]));
  });

  it("ignores filter keys for columns without filters", () => {
    const s = parseState("?f_chip=Foo", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.chip).toBeUndefined();
  });

  it("ignores filter keys for unknown columns", () => {
    const s = parseState("?f_bogus=1", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.bogus).toBeUndefined();
  });
});

describe("parseState — range filters", () => {
  it("reads a fully-bounded range", () => {
    const s = parseState("?f_year=2024:2026", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toEqual([2024, 2026]);
  });

  it("reads a lower-unbounded range (2024:)", () => {
    const s = parseState("?f_year=2024:", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toEqual([2024, 2026]);
  });

  it("reads an upper-unbounded range (:2026)", () => {
    const s = parseState("?f_year=:2026", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toEqual([2020, 2026]);
  });

  it("clamps out-of-range numbers to data bounds", () => {
    const s = parseState("?f_year=1900:9999", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toEqual([2020, 2026]);
  });

  it("ignores a non-finite min", () => {
    const s = parseState("?f_year=abc:2026", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toBeUndefined();
  });

  it("ignores an inverted range (min > max)", () => {
    const s = parseState("?f_year=2026:2020", COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.year).toBeUndefined();
  });
});

describe("serializeState — defaults omitted", () => {
  it("emits no params for the default state", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.toString()).toBe("");
  });

  it("omits sort when no sort is set", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.has("sort")).toBe(false);
  });

  it("omits cols when visible matches default", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.has("cols")).toBe(false);
  });

  it("emits cols when visible differs from default", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.visibleCols = new Set(["chip", "year"]);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("cols")).toBe("chip,year");
  });

  it("preserves the canonical column order in cols", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    // Pass visibleCols in a different order — should be normalized.
    s.visibleCols = new Set(["thunderbolt", "chip", "year"]);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("cols")).toBe("chip,year,thunderbolt");
  });
});

describe("serializeState — filters", () => {
  it("emits a set filter", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.tier = new Set(["Max", "Ultra"]);
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_tier")).toBe("Max,Ultra");
  });

  it("omits an empty set filter", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.tier = new Set();
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.has("f_tier")).toBe(false);
  });

  it("emits a partially-bounded range (lower-unbounded)", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.year = [2020, 2024]; // at lower bound
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_year")).toBe(":2024");
  });

  it("emits a partially-bounded range (upper-unbounded)", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.year = [2024, 2026]; // at upper bound
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_year")).toBe("2024:");
  });

  it("omits a range filter at the data bounds (default)", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.year = [2020, 2026];
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.has("f_year")).toBe(false);
  });

  it("emits a fully-bounded range when both bounds differ from default", () => {
    const s = parseState("", COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.year = [2024, 2025];
    const params = serializeState(s, COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_year")).toBe("2024:2025");
  });
});

describe("round-trip", () => {
  it("state → URL → state preserves everything", () => {
    const original = {
      q: "M3 Max",
      sorting: [{ id: "year", desc: true }],
      visibleCols: new Set(["chip", "generation", "tier", "year", "thunderbolt"]),
      columnFilters: {
        tier: new Set(["Max"]),
        year: [2024, 2026],
        cpuCores: [10, 24],
      },
    };
    const params = serializeState(original, COLUMNS, DEFAULT_VISIBLE);
    const round = parseState(`?${params.toString()}`, COLUMNS, DEFAULT_VISIBLE);
    expect(round.q).toBe(original.q);
    expect(round.sorting).toEqual(original.sorting);
    expect(round.visibleCols).toEqual(original.visibleCols);
    expect(round.columnFilters).toEqual(original.columnFilters);
  });

  it("empty URL round-trips to default state", () => {
    const a = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const params = serializeState(a, COLUMNS, DEFAULT_VISIBLE);
    const b = parseState(`?${params.toString()}`, COLUMNS, DEFAULT_VISIBLE);
    expect(b).toEqual(a);
  });
});

describe("applyToHistory — DOM-touching", () => {
  it("calls replaceState when replace is true", () => {
    const replace = vi.fn();
    const push = vi.fn();
    window.history.replaceState = replace;
    window.history.pushState = push;
    const params = new URLSearchParams("q=foo");
    applyToHistory(params, { replace: true });
    expect(replace).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("calls pushState by default", () => {
    const replace = vi.fn();
    const push = vi.fn();
    window.history.replaceState = replace;
    window.history.pushState = push;
    const params = new URLSearchParams("q=foo");
    applyToHistory(params);
    expect(push).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing when params match the current URL", () => {
    // Stubs that also update window.location.search to mimic real browser behavior.
    const replace = vi.fn((_state, _title, url) => {
      const q = url.split("?")[1] ?? "";
      Object.defineProperty(window, "location", {
        value: { ...window.location, search: q ? `?${q}` : "", pathname: "/" },
        writable: true,
      });
    });
    window.history.replaceState = replace;
    window.history.pushState = vi.fn();

    // Set the current URL to ?q=foo via the (mock) replace.
    window.history.replaceState(null, "", "/?q=foo");
    expect(replace).toHaveBeenCalledOnce();

    // Now apply the same params — should be a no-op.
    applyToHistory(new URLSearchParams("q=foo"));
    expect(replace).toHaveBeenCalledOnce(); // still 1, not 2
  });
});

describe("statesEqual", () => {
  it("returns true for two default states", () => {
    const a = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const b = parseState("", COLUMNS, DEFAULT_VISIBLE);
    expect(statesEqual(a, b)).toBe(true);
  });

  it("returns false when q differs", () => {
    const a = parseState("", COLUMNS, DEFAULT_VISIBLE);
    const b = parseState("?q=M3", COLUMNS, DEFAULT_VISIBLE);
    expect(statesEqual(a, b)).toBe(false);
  });

  it("returns false when a set filter differs", () => {
    const a = { ...parseState("", COLUMNS, DEFAULT_VISIBLE) };
    const b = { ...parseState("?f_tier=Max", COLUMNS, DEFAULT_VISIBLE) };
    expect(statesEqual(a, b)).toBe(false);
  });

  it("returns true when the same set filter is parsed twice", () => {
    const a = parseState("?f_tier=Max", COLUMNS, DEFAULT_VISIBLE);
    const b = parseState("?f_tier=Max", COLUMNS, DEFAULT_VISIBLE);
    expect(statesEqual(a, b)).toBe(true);
  });

  it("returns true when the same range filter is parsed twice", () => {
    const a = parseState("?f_year=2024:2026", COLUMNS, DEFAULT_VISIBLE);
    const b = parseState("?f_year=2024:2026", COLUMNS, DEFAULT_VISIBLE);
    expect(statesEqual(a, b)).toBe(true);
  });
});

describe("parseState — range-discrete filters", () => {
  const DISCRETE_COLUMNS = [
    ...COLUMNS,
    { accessorKey: "maxRAM", header: "Max RAM", filter: { type: "range-discrete", values: [16, 24, 32, 64, 96, 128, 192], min: 16, max: 192 } },
  ];

  it("reads a fully-bounded range", () => {
    const s = parseState("?f_maxRAM=32:128", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.maxRAM).toEqual([32, 128]);
  });

  it("reads a lower-unbounded range", () => {
    const s = parseState("?f_maxRAM=64:", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.maxRAM).toEqual([64, 192]);
  });

  it("reads an upper-unbounded range", () => {
    const s = parseState("?f_maxRAM=:64", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.maxRAM).toEqual([16, 64]);
  });

  it("snaps an out-of-set value to the nearest allowed value", () => {
    // 50 is not in {16, 24, 32, 64, 96, 128, 192}; closest is 64 (diff 14) vs 32 (diff 18).
    const s = parseState("?f_maxRAM=50:128", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.maxRAM).toEqual([64, 128]);
  });

  it("ignores an inverted range even after snapping", () => {
    // 200 snaps to 192, 8 snaps to 16 → snapped min (192) > snapped max (16),
    // so the filter is dropped rather than silently applied backwards.
    const s = parseState("?f_maxRAM=200:8", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(s.columnFilters.maxRAM).toBeUndefined();
  });
});

describe("serializeState — range-discrete filters", () => {
  const DISCRETE_COLUMNS = [
    ...COLUMNS,
    { accessorKey: "maxRAM", header: "Max RAM", filter: { type: "range-discrete", values: [16, 24, 32, 64, 96, 128, 192], min: 16, max: 192 } },
  ];

  it("emits a fully-bounded range", () => {
    const s = parseState("", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.maxRAM = [32, 128];
    const params = serializeState(s, DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_maxRAM")).toBe("32:128");
  });

  it("emits a lower-unbounded range", () => {
    const s = parseState("", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.maxRAM = [16, 128]; // at data min
    const params = serializeState(s, DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(params.get("f_maxRAM")).toBe(":128");
  });

  it("omits the filter when at the data bounds", () => {
    const s = parseState("", DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    s.columnFilters.maxRAM = [16, 192];
    const params = serializeState(s, DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(params.has("f_maxRAM")).toBe(false);
  });
});

describe("round-trip — range-discrete", () => {
  const DISCRETE_COLUMNS = [
    ...COLUMNS,
    { accessorKey: "maxRAM", header: "Max RAM", filter: { type: "range-discrete", values: [16, 24, 32, 64, 96, 128, 192], min: 16, max: 192 } },
  ];

  it("state → URL → state preserves a discrete range", () => {
    const original = {
      q: "",
      sorting: [],
      visibleCols: new Set(DEFAULT_VISIBLE),
      columnFilters: { maxRAM: [64, 128] },
    };
    const params = serializeState(original, DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    const round = parseState(`?${params.toString()}`, DISCRETE_COLUMNS, DEFAULT_VISIBLE);
    expect(round.columnFilters.maxRAM).toEqual([64, 128]);
  });
});
