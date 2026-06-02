#!/usr/bin/env bun
// Usage: bun export-csv.js
// Reads src/chips.json, writes chips.csv to the project root

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, "src/chips.json");
const csvPath = resolve(__dirname, "chips.csv");

const chips = JSON.parse(await Bun.file(jsonPath).text());

const columns = [
  { key: "chip",                label: "Chip"                    },
  { key: "generation",          label: "Generation"              },
  { key: "tier",                label: "Tier"                    },
  { key: "year",                label: "Year"                    },
  { key: "processNode",         label: "Process Node"            },
  { key: "cpuCores",            label: "CPU Cores"               },
  { key: "perfCores",           label: "Perf Cores"              },
  { key: "efficiencyCores",     label: "Efficiency Cores"        },
  { key: "gpuCores",            label: "GPU Cores"               },
  { key: "neuralEngineCores",   label: "Neural Engine Cores"     },
  { key: "neuralEngineTOPS",    label: "Neural Engine TOPS"      },
  { key: "maxUnifiedMemoryGB",  label: "Max Unified Memory (GB)" },
  { key: "memoryBandwidthGBs",  label: "Memory Bandwidth (GB/s)" },
  { key: "transistorsBillions", label: "Transistors (B)"         },
  { key: "thunderbolt",         label: "Thunderbolt"             },
];

const escape = (val) => {
  if (val === null || val === undefined) return "N/A";
  const str = String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
};

const header = columns.map((c) => escape(c.label)).join(",");
const rows = chips.map((chip) => columns.map((c) => escape(chip[c.key])).join(","));
const csv = [header, ...rows].join("\n");

await Bun.write(csvPath, csv);
console.log(`✓ Wrote ${chips.length} chips to ${csvPath}`);
