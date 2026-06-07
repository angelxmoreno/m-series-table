// Shared type definitions for the table. Kept in a single file (rather than
// co-located with each module) because every module depends on most of these
// types — splitting them up would just mean more import lines for no benefit.

// One entry in src/chips.json. `processNode`, `neuralEngineTOPS`, and
// `transistorsBillions` can be null when Apple has not published a figure
// (e.g. M5). All other fields are required.
export interface Chip {
  chip: string;
  generation: string;
  tier: "Base" | "Pro" | "Max" | "Ultra";
  year: number;
  processNode: string | null;
  cpuCores: number;
  perfCores: number;
  efficiencyCores: number;
  gpuCores: number;
  neuralEngineCores: number;
  neuralEngineTOPS: number | null;
  maxUnifiedMemoryGB: number;
  memoryBandwidthGBs: number;
  transistorsBillions: number | null;
  thunderbolt: "TB3" | "TB4" | "TB5";
}

// One sort entry, matching TanStack Table's shape. We only ever have a single
// sort key at a time; the array shape is what TanStack expects.
export interface SortItem {
  id: string;
  desc: boolean;
}

// Per-column filter, as stored in view state. The active value's shape
// depends on the column's filter config:
//   set            → Set<string>
//   range          → [min: number, max: number]
//   range-discrete → [min: number, max: number]  (same shape as range)
export type FilterValue = Set<string> | [number, number];

// The full view state. Lives in the URL via urlState.ts.
export interface ViewState {
  q: string;
  sorting: SortItem[];
  visibleCols: Set<string>;
  columnFilters: Record<string, FilterValue>;
}

// Filter "shape" before augmentation. At that point we know the *kind* of
// filter but not the data-derived bounds/values.
export type ColumnFilterShape =
  | { type: "set" }
  | { type: "range" }
  | { type: "range-discrete" };

// Fully-resolved filter, after the augmentation pass in AppleSiliconTable.
export type ColumnFilter =
  | { type: "set"; values: string[] }
  | { type: "range"; min: number; max: number }
  | { type: "range-discrete"; values: number[]; min: number; max: number };

// TanStack Table's cell renderer for our Chip rows.
export type CellRenderer = (ctx: { getValue: () => string | number | null }) => string;

// Column shape before augmentation: just the static bits and the filter
// *kind*. The augmentation pass replaces `filter` with the full ColumnFilter.
// `accessorKey` is typed `string` (not `keyof Chip`) so stub columns in tests
// and the urlState parser can use any key.
export interface ColumnDef {
  accessorKey: string;
  header: string;
  description?: string;
  filter?: ColumnFilterShape;
  cell?: CellRenderer;
}

// Augmented column shape, used at render time. The filter is fully resolved
// (with values/min/max derived from the data) — see AppleSiliconTable.tsx.
export interface Column {
  accessorKey: string;
  header: string;
  description?: string;
  filter?: ColumnFilter;
  cell?: CellRenderer;
}

// A single piece of the human-readable summary. The `kind` discriminates the
// shape; `key` is the column accessorKey for filter fragments only.
export type Fragment =
  | { kind: "default"; text: string }
  | { kind: "search"; text: string }
  | { kind: "filter"; key: string; text: string }
  | { kind: "sort"; text: string }
  | { kind: "cols"; text: string };
