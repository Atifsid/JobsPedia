import { describe, expect, it } from "vitest";
import { toIsoDate } from "../../../src/sources/common/date.js";

describe("toIsoDate", () => {
  it("converts a unix-seconds timestamp to ISO", () => {
    expect(toIsoDate(1780000000)).toBe(new Date(1780000000 * 1000).toISOString());
  });

  it("converts a unix-milliseconds timestamp to ISO", () => {
    expect(toIsoDate(1780000000000)).toBe(new Date(1780000000000).toISOString());
  });

  it("passes a parseable date string through as ISO", () => {
    expect(toIsoDate("2026-01-15T10:00:00.000Z")).toBe("2026-01-15T10:00:00.000Z");
  });

  it("returns null for null, undefined, empty string, and unparseable input", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("not-a-date")).toBeNull();
  });
});
