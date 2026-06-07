import { describe, expect, it } from "vitest";
import { fmt } from "./fmt";

describe("fmt helper", () => {
  it("returns — for null", () => {
    expect(fmt(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(fmt(undefined)).toBe("—");
  });

  it("returns the value as a string for numbers", () => {
    expect(fmt(42)).toBe("42");
  });

  it("appends a suffix when provided", () => {
    expect(fmt(16, " GB")).toBe("16 GB");
  });

  it("appends suffix to string values", () => {
    expect(fmt("100", " GB/s")).toBe("100 GB/s");
  });

  it("does not append suffix when value is null", () => {
    expect(fmt(null, " GB")).toBe("—");
  });

  it("does not append suffix when value is undefined", () => {
    expect(fmt(undefined, " GB/s")).toBe("—");
  });

  it("handles zero correctly", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(0, " GB")).toBe("0 GB");
  });
});
