import { describe, expect, it, vi } from "vitest";
import { paginate } from "../../../src/sources/common/pagination.js";

describe("paginate", () => {
  it("follows offset pages until total is reached", async () => {
    const pages = [
      { items: ["a", "b"], total: 5 },
      { items: ["c", "d"], total: 5 },
      { items: ["e"], total: 5 },
    ];
    const fetchPage = vi.fn(async (offset: number) => pages[offset / 2]);
    const result = await paginate(fetchPage, 2);
    expect(result).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("stops after one call when the first page is already empty", async () => {
    const fetchPage = vi.fn(async () => ({ items: [], total: 0 }));
    const result = await paginate(fetchPage, 100);
    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
