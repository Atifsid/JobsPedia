import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSkipInvalid } from "../../../src/sources/common/records.js";

describe("mapSkipInvalid", () => {
  afterEach(() => vi.restoreAllMocks());

  it("skips a record whose mapper throws, logs it, and keeps the rest", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = [1, 2, 3];
    const result = mapSkipInvalid(
      raw,
      (n) => {
        if (n === 2) throw new Error("bad record");
        return n * 10;
      },
      "test-source",
    );
    expect(result).toEqual([10, 30]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("test-source"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("bad record"));
  });

  it("returns every mapped item when nothing throws", () => {
    const result = mapSkipInvalid([1, 2, 3], (n) => n * 10, "test-source");
    expect(result).toEqual([10, 20, 30]);
  });
});
