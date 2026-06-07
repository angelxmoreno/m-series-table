// Format a cell value for display. Renders null/undefined as an em-dash so
// unknown fields don't blow up the table layout. Used in column `cell`
// callbacks. Kept as its own module so it's testable in isolation — see
// src/fmt.test.ts.
export const fmt = (v: string | number | null | undefined, s: string = ""): string =>
  v === null || v === undefined ? "—" : `${v}${s}`;
