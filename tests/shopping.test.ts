import { describe, expect, it } from "vitest";
import {
  groupByShoppingCategory,
  normalizeProductName,
} from "../shared/shopping";

describe("shopping product rules", () => {
  it("normalizes capitalization and whitespace for duplicate matching", () => {
    expect(normalizeProductName("  Mleko   OWSIANE ")).toBe("mleko owsiane");
    expect(normalizeProductName("ŚMIETANA")).toBe("śmietana");
  });

  it("groups in configured order and sends unknown categories to Inne", () => {
    const groups = groupByShoppingCategory(
      [
        { name: "Mleko", category: "Nabiał" },
        { name: "Bagietka", category: "Pieczywo" },
        { name: "Baterie", category: "Elektronika" },
      ],
      ["Pieczywo", "Nabiał", "Inne"],
    );
    expect(groups.map(([category]) => category)).toEqual([
      "Pieczywo",
      "Nabiał",
      "Inne",
    ]);
    expect(groups[2][1]).toEqual([
      { name: "Baterie", category: "Elektronika" },
    ]);
  });
});
