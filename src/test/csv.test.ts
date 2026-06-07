import { describe, it, expect } from "vitest";
import chipsJson from "../chips.json";
import type { Chip } from "../types";

const chips = chipsJson as Chip[];

// Re-implement the CSV escape logic from ../../export-csv.js
const escape = (val: unknown): string => {
  if (val === null || val === undefined) return "N/A";
  const str = String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
};

describe("CSV export logic", () => {
  it("escapes null values as N/A", () => {
    expect(escape(null)).toBe("N/A");
  });

  it("escapes undefined values as N/A", () => {
    expect(escape(undefined)).toBe("N/A");
  });

  it("passes through plain strings", () => {
    expect(escape("M4 Pro")).toBe("M4 Pro");
  });

  it("passes through numbers", () => {
    expect(escape(42)).toBe("42");
  });

  it("quotes values with commas", () => {
    expect(escape("hello, world")).toBe('"hello, world"');
  });

  it("quotes values with double quotes and doubles them", () => {
    expect(escape('say "hello"')).toBe('"say ""hello"""');
  });

  it("quotes values with newlines", () => {
    expect(escape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("generates a valid CSV from chips data", () => {
    const columns = [
      "chip", "generation", "tier", "year", "processNode",
      "cpuCores", "perfCores", "efficiencyCores", "gpuCores",
      "neuralEngineCores", "neuralEngineTOPS", "maxUnifiedMemoryGB",
      "memoryBandwidthGBs", "transistorsBillions", "thunderbolt",
    ];
    const header = columns.join(",");
    const rows = chips.map((c) => columns.map((k) => escape((c as unknown as Record<string, unknown>)[k])).join(","));
    const csv = [header, ...rows].join("\n");

    expect(csv).toContain("chip,generation,tier");
    expect(csv.split("\n").length).toBe(chips.length + 1); // header + rows
  });
});