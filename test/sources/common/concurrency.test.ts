import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../../../src/sources/common/concurrency.js";

describe("mapWithConcurrency", () => {
  it("respects the concurrency limit and preserves result order", async () => {
    let active = 0;
    let maxActive = 0;
    const fn = async (n: number): Promise<number> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n * 2;
    };
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, fn);
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("returns an empty array for an empty input", async () => {
    const results = await mapWithConcurrency<number, number>([], 5, async (n) => n);
    expect(results).toEqual([]);
  });
});
