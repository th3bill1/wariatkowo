import { describe, expect, it } from "vitest";
import {
  randomRotation,
  randomUniqueItems,
} from "../src/utils/randomSelection";
describe("polaroid random selection", () => {
  it("never duplicates photos and gracefully limits the count", () => {
    const selected = randomUniqueItems(["a", "b", "c"], 6, () => 0.5);
    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
  });
  it("keeps rotations restrained", () => {
    expect(randomRotation(() => 0)).toBe(-6);
    expect(randomRotation(() => 1)).toBe(6);
  });
});
