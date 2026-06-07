import { describe, expect, it } from "vitest";
import chipsJson from "./chips.json";
import type { Chip } from "./types";

const chips = chipsJson as Chip[];

describe("chips.json", () => {
  it("has entries for every M-series generation", () => {
    const generations = [...new Set(chips.map((c) => c.generation))];
    expect(generations).toContain("M1");
    expect(generations).toContain("M2");
    expect(generations).toContain("M3");
    expect(generations).toContain("M4");
    expect(generations).toContain("M5");
  });

  it("has all required fields on every entry", () => {
    const required = [
      "chip",
      "generation",
      "tier",
      "year",
      "processNode",
      "cpuCores",
      "perfCores",
      "efficiencyCores",
      "gpuCores",
      "neuralEngineCores",
      "neuralEngineTOPS",
      "maxUnifiedMemoryGB",
      "memoryBandwidthGBs",
      "transistorsBillions",
      "thunderbolt",
    ];
    for (const c of chips) {
      for (const key of required) {
        expect(c).toHaveProperty(key);
      }
    }
  });

  it("uses only valid tiers", () => {
    const valid = ["Base", "Pro", "Max", "Ultra"];
    for (const c of chips) {
      expect(valid).toContain(c.tier);
    }
  });

  it("has cpuCores = perfCores + efficiencyCores when all are present", () => {
    for (const c of chips) {
      if (c.cpuCores != null && c.perfCores != null && c.efficiencyCores != null) {
        expect(c.perfCores + c.efficiencyCores).toBe(c.cpuCores);
      }
    }
  });

  it("has non-negative numeric values (or null) for all spec fields", () => {
    const numericFields = [
      "cpuCores",
      "perfCores",
      "efficiencyCores",
      "gpuCores",
      "neuralEngineCores",
      "neuralEngineTOPS",
      "maxUnifiedMemoryGB",
      "memoryBandwidthGBs",
      "transistorsBillions",
    ];
    for (const c of chips) {
      for (const key of numericFields) {
        const value = (c as unknown as Record<string, unknown>)[key];
        if (value !== null && value !== undefined) {
          expect(value).toSatisfy(
            (v) => typeof v === "number" && v >= 0,
            `${key} should be non-negative`
          );
        }
      }
    }
  });

  it("has years in a reasonable range", () => {
    for (const c of chips) {
      expect(c.year).toBeGreaterThanOrEqual(2020);
      expect(c.year).toBeLessThanOrEqual(2027);
    }
  });

  it("has valid thunderbolt values", () => {
    const validTB = ["TB3", "TB4", "TB5"];
    for (const c of chips) {
      expect(validTB).toContain(c.thunderbolt);
    }
  });

  it("chip names are unique", () => {
    const names = chips.map((c) => c.chip);
    expect(new Set(names).size).toBe(names.length);
  });

  it("M5 entries have null TOPS and transistors (not yet announced)", () => {
    const m5 = chips.filter((c) => c.generation === "M5");
    for (const c of m5) {
      expect(c.neuralEngineTOPS).toBeNull();
      expect(c.transistorsBillions).toBeNull();
    }
  });
});
