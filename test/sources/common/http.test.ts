import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchText } from "../../../src/sources/common/http.js";

describe("fetchJson", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries on a 500 and succeeds on a later attempt", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls < 3) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => ({ hello: "world" }) };
      }),
    );
    const promise = fetchJson("https://example.com/x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ hello: "world" });
    expect(calls).toBe(3);
  });

  it("does not retry on a 404 and throws immediately", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchJson("https://example.com/missing");
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error (fetch throws)", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls < 2) throw new TypeError("network error");
        return { ok: true, json: async () => ({ ok: true }) };
      }),
    );
    const promise = fetchJson("https://example.com/flaky");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("gives up after the max attempts on a persistent 5xx", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchJson("https://example.com/down");
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("fetchText", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns response text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "<xml/>" })));
    await expect(fetchText("https://example.com/x.xml")).resolves.toBe("<xml/>");
  });
});
