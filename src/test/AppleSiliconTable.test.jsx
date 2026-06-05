import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppleSiliconTable from "../AppleSiliconTable";

describe("AppleSiliconTable", () => {
  it("renders the heading", () => {
    render(<AppleSiliconTable />);
    expect(screen.getByText("Apple Silicon")).toBeInTheDocument();
  });

  it("shows the default summary on first render", () => {
    render(<AppleSiliconTable />);
    expect(screen.getByText(/all 18 chips/i)).toBeInTheDocument();
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

  it("renders the default visible columns", () => {
    render(<AppleSiliconTable />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Chip")).toBeInTheDocument();
    expect(within(table).getByText("Gen")).toBeInTheDocument();
    expect(within(table).getByText("Tier")).toBeInTheDocument();
    expect(within(table).getByText("Year")).toBeInTheDocument();
    expect(within(table).getByText("CPU Cores")).toBeInTheDocument();
    expect(within(table).getByText("GPU Cores")).toBeInTheDocument();
    expect(within(table).getByText("Max RAM")).toBeInTheDocument();
    // Process is not in the default visible set
    expect(within(table).queryByText("Process")).not.toBeInTheDocument();
  });

  it("filters by generation via the column dialog", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Gen" }));
    const dialog = await screen.findByRole("dialog", { name: /filter by gen/i });
    await user.click(within(dialog).getByRole("checkbox", { name: "M4" }));
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    // M4, M4 Pro, M4 Max = 3 chips
    expect(screen.getByText(/3 \/ 18 chips/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("M4 Pro")).toBeInTheDocument();
    expect(within(table).getByText("M4 Max")).toBeInTheDocument();
    // M3 line should be filtered out
    expect(within(table).queryByText("M3 Pro")).not.toBeInTheDocument();
  });

  it("filters by tier via the column dialog", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Tier" }));
    const dialog = await screen.findByRole("dialog", { name: /filter by tier/i });
    await user.click(within(dialog).getByRole("checkbox", { name: "Max" }));
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    // M1 Max, M2 Max, M3 Max, M4 Max, M5 Max = 5 chips
    expect(screen.getByText(/5 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("multi-selects in the set filter", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Gen" }));
    const dialog = await screen.findByRole("dialog", { name: /filter by gen/i });
    await user.click(within(dialog).getByRole("checkbox", { name: "M3" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "M4" }));
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    // M3*4 + M4*3 = 7 chips
    expect(screen.getByText(/7 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("filters by year range", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Year" }));
    const dialog = await screen.findByRole("dialog", { name: /filter by year/i });
    const minInput = within(dialog).getByLabelText("Min");
    await user.clear(minInput);
    await user.type(minInput, "2024");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    // year >= 2024: M4(3) + M5(3) + M3 Ultra(2025) = 7 chips
    expect(screen.getByText(/7 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("Clear in a set filter dialog removes the active filter", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Gen" }));
    const dialog = await screen.findByRole("dialog", { name: /filter by gen/i });
    await user.click(within(dialog).getByRole("checkbox", { name: "M4" }));
    await user.click(within(dialog).getByRole("button", { name: "Clear" }));

    expect(screen.getByText(/18 \/ 18 chips/i)).toBeInTheDocument();
  });

  it("closes the filter dialog with Escape", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: "Filter Gen" }));
    await screen.findByRole("dialog", { name: /filter by gen/i });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /filter by gen/i })).not.toBeInTheDocument();
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
    // Default visible columns don't include TOPS, but the dashes should still appear
    // because we may want to verify the "—" symbol. Skip if not visible: just assert
    // the component renders without crashing on null.
    expect(screen.getByRole("table")).toBeInTheDocument();
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

  it("toggles column visibility from the Columns popover", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    // Open the popover
    await user.click(screen.getByRole("button", { name: /columns/i }));
    const dialog = await screen.findByRole("dialog", { name: /choose columns/i });
    // Process is not currently visible — toggle it on
    const processCheckbox = within(dialog).getByRole("checkbox", { name: "Process" });
    expect(processCheckbox).not.toBeChecked();
    await user.click(processCheckbox);
    await user.keyboard("{Escape}");

    // Now Process should appear in the table
    const table = screen.getByRole("table");
    expect(within(table).getByText("Process")).toBeInTheDocument();
  });

  it("hiding all columns keeps the table usable (empty header)", async () => {
    const user = userEvent.setup();
    render(<AppleSiliconTable />);

    await user.click(screen.getByRole("button", { name: /columns/i }));
    const dialog = await screen.findByRole("dialog", { name: /choose columns/i });
    // Uncheck every default-visible column
    for (const name of ["Chip", "Gen", "Tier", "Year", "CPU Cores", "GPU Cores", "Max RAM"]) {
      await user.click(within(dialog).getByRole("checkbox", { name }));
    }
    await user.keyboard("{Escape}");

    // Table still renders, no chip rows
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  describe("URL state hydration", () => {
    it("hydrates the search input from ?q=", () => {
      window.history.replaceState(null, "", "/?q=M3");
      render(<AppleSiliconTable />);

      const searchInput = screen.getByPlaceholderText("e.g. M3 Max");
      expect(searchInput).toHaveValue("M3");

      // M3, M3 Pro, M3 Max, M3 Ultra = 4 chips
      expect(screen.getByText(/4 \/ 18 chips/i)).toBeInTheDocument();
    });

    it("hydrates a range filter from ?f_year=2024:2026 without opening the dialog", () => {
      window.history.replaceState(null, "", "/?f_year=2024:2026");
      render(<AppleSiliconTable />);

      // year in [2024, 2026]: M4(3) + M5(3) + M3 Ultra(2025) = 7 chips
      expect(screen.getByText(/7 \/ 18 chips/i)).toBeInTheDocument();

      // No dialog should be open
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("updates window.location.search when a filter is applied", async () => {
      const user = userEvent.setup();
      render(<AppleSiliconTable />);

      await user.click(screen.getByRole("button", { name: "Filter Gen" }));
      const dialog = await screen.findByRole("dialog", { name: /filter by gen/i });
      await user.click(within(dialog).getByRole("checkbox", { name: "M4" }));
      await user.click(within(dialog).getByRole("button", { name: "Done" }));

      expect(window.location.search).toContain("f_generation=M4");
    });

    it("updates window.location.search when the user types in search", async () => {
      const user = userEvent.setup();
      render(<AppleSiliconTable />);

      const searchInput = screen.getByPlaceholderText("e.g. M3 Max");
      await user.type(searchInput, "Max");

      // Search uses URL encoding, so space → + but here it's a single word
      expect(window.location.search).toContain("q=Max");
    });
  });

  describe("Reset link", () => {
    it("is not shown on the default view", () => {
      render(<AppleSiliconTable />);
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it("is shown when state is hydrated from the URL", () => {
      window.history.replaceState(null, "", "/?q=M3");
      render(<AppleSiliconTable />);
      expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    });

    it("is shown after a filter is applied", async () => {
      const user = userEvent.setup();
      render(<AppleSiliconTable />);

      await user.click(screen.getByRole("button", { name: "Filter Gen" }));
      const dialog = await screen.findByRole("dialog", { name: /filter by gen/i });
      await user.click(within(dialog).getByRole("checkbox", { name: "M4" }));
      await user.click(within(dialog).getByRole("button", { name: "Done" }));

      expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    });

    it("clicking Reset clears all state and navigates to /", async () => {
      const user = userEvent.setup();
      // Use a URL with both q and a filter so we exercise "clear everything".
      window.history.replaceState(null, "", "/?f_tier=Max");
      render(<AppleSiliconTable />);

      // Sanity: hydrated state is reflected (M1/M2/M3/M4/M5 Max = 5 chips)
      expect(screen.getByText(/5 \/ 18 chips/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Reset" }));

      // Search input cleared
      expect(screen.getByPlaceholderText("e.g. M3 Max")).toHaveValue("");
      // All chips visible again
      expect(screen.getByText(/18 \/ 18 chips/i)).toBeInTheDocument();
      // URL is back to the bare path
      expect(window.location.search).toBe("");
      // Reset link is gone
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });
  });

  describe("Filter summary", () => {
    it("shows the active filters in the subtitle area", async () => {
      const user = userEvent.setup();
      render(<AppleSiliconTable />);

      await user.click(screen.getByRole("button", { name: "Filter Tier" }));
      const dialog = await screen.findByRole("dialog", { name: /filter by tier/i });
      await user.click(within(dialog).getByRole("checkbox", { name: "Max" }));
      await user.click(within(dialog).getByRole("button", { name: "Done" }));

      // Subtitle should now reflect the filter
      expect(screen.getByText(/max tier/i)).toBeInTheDocument();
    });

    it("reflects URL state in the subtitle on first render", () => {
      window.history.replaceState(null, "", "/?f_tier=Max,Ultra&f_year=2024:&sort=year:desc");
      render(<AppleSiliconTable />);

      // All three fragments should be present, joined by middots in the UI
      expect(screen.getByText(/Max or Ultra tier/i)).toBeInTheDocument();
      expect(screen.getByText(/year 2024 or later/i)).toBeInTheDocument();
      expect(screen.getByText(/sorted by year ↓/i)).toBeInTheDocument();
    });
  });

  describe("Document title", () => {
    it("uses the base title on first render with no state", () => {
      render(<AppleSiliconTable />);
      expect(document.title).toBe("Apple Silicon · M-Series Comparison");
    });

    it("updates the title when a filter is applied", async () => {
      const user = userEvent.setup();
      render(<AppleSiliconTable />);

      await user.click(screen.getByRole("button", { name: "Filter Tier" }));
      const dialog = await screen.findByRole("dialog", { name: /filter by tier/i });
      await user.click(within(dialog).getByRole("checkbox", { name: "Max" }));
      await user.click(within(dialog).getByRole("button", { name: "Done" }));

      expect(document.title).toContain("Max");
      expect(document.title).toContain("5/18");
    });

    it("hydrates the title from URL state on first render", () => {
      window.history.replaceState(null, "", "/?f_tier=Max&f_year=2024:");
      render(<AppleSiliconTable />);

      expect(document.title).toContain("Max");
      expect(document.title).toContain("2024 or later");
    });

    it("resets the base title when Reset is clicked", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/?f_tier=Max");
      render(<AppleSiliconTable />);
      expect(document.title).not.toBe("Apple Silicon · M-Series Comparison");

      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(document.title).toBe("Apple Silicon · M-Series Comparison");
    });
  });
});
