import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppleSiliconTable from "../AppleSiliconTable";

describe("AppleSiliconTable", () => {
  it("renders the heading", () => {
    render(<AppleSiliconTable />);
    expect(screen.getByText("Apple Silicon")).toBeInTheDocument();
  });

  it("shows all chips initially", () => {
    render(<AppleSiliconTable />);
    expect(screen.getByText(/18 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("renders chip names in the table body", () => {
    render(<AppleSiliconTable />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("M4 Pro")).toBeInTheDocument();
    expect(within(table).getByText("M5 Max")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<AppleSiliconTable />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Chip")).toBeInTheDocument();
    expect(within(table).getByText("Gen")).toBeInTheDocument();
    expect(within(table).getByText("Tier")).toBeInTheDocument();
    expect(within(table).getByText("Year")).toBeInTheDocument();
    expect(within(table).getByText("Process")).toBeInTheDocument();
  });

  it("filters by generation", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    const selects = screen.getAllByRole("combobox");
    const genSelect = selects[0]; // first select = generation
    await user.selectOptions(genSelect, "M4");

    // M4, M4 Pro, M4 Max = 3 chips
    expect(screen.getByText(/3 \/ 18 chips/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    // "M4" appears in both the chip name and generation columns, so use getAllByText
    expect(within(table).getAllByText("M4").length).toBeGreaterThanOrEqual(1);
    expect(within(table).getByText("M4 Pro")).toBeInTheDocument();
    expect(within(table).getByText("M4 Max")).toBeInTheDocument();
  });

  it("filters by tier", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    const selects = screen.getAllByRole("combobox");
    const tierSelect = selects[1]; // second select = tier
    await user.selectOptions(tierSelect, "Max");

    // M1 Max, M2 Max, M3 Max, M4 Max, M5 Max = 5 chips
    expect(screen.getByText(/5 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("searches by chip name", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    const searchInput = screen.getByPlaceholderText("e.g. M3 Max");
    await user.type(searchInput, "M3");

    // M3, M3 Pro, M3 Max, M3 Ultra = 4 chips
    expect(screen.getByText(/4 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("shows — for null values", () => {
    render(<AppleSiliconTable />);
    // M5 has null TOPS and transistors — those cells should render —
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders the Export CSV button", () => {
    render(<AppleSiliconTable />);
    expect(screen.getByText(/export csv/i)).toBeInTheDocument();
  });

  it("shows empty state when no chips match", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    const searchInput = screen.getByPlaceholderText("e.g. M3 Max");
    await user.type(searchInput, "nonexistent chip xyz");

    expect(screen.getByText(/no chips match your filters/i)).toBeInTheDocument();
  });
});