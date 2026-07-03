import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYcCompanies } from "../../src/discovery/ycombinator.js";

const PAGE_HTML = `<html><script>window.AlgoliaOpts = {"app":"45BWZJ1SGC","key":"test-search-key"};</script></html>`;

function algoliaHit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Acme",
    website: "https://acme.com",
    industries: ["B2B"],
    tags: ["Fintech"],
    batch: "W24",
    isHiring: true,
    ...overrides,
  };
}

describe("fetchYcCompanies", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extracts Algolia credentials from the YC companies page, then paginates all hiring companies", async () => {
    let queryCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("ycombinator.com/companies")) {
          return { ok: true, text: async () => PAGE_HTML };
        }
        // Algolia query endpoint
        expect(url).toBe("https://45BWZJ1SGC-dsn.algolia.net/1/indexes/YCCompany_production/query");
        expect(init?.headers).toMatchObject({ "X-Algolia-API-Key": "test-search-key", "X-Algolia-Application-Id": "45BWZJ1SGC" });
        const body = JSON.parse(init!.body as string);
        expect(body.filters).toBe("isHiring:true");
        queryCalls++;
        if (body.page === 0) {
          return {
            ok: true,
            json: async () => ({
              hits: [algoliaHit({ name: "Acme" }), algoliaHit({ name: "Beta" })],
              page: 0,
              nbPages: 2,
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ hits: [algoliaHit({ name: "Gamma" })], page: 1, nbPages: 2 }),
        };
      }),
    );

    const companies = await fetchYcCompanies();

    expect(companies.map((c) => c.name)).toEqual(["Acme", "Beta", "Gamma"]);
    expect(companies[0]).toEqual({
      name: "Acme",
      website: "https://acme.com",
      industries: ["B2B"],
      tags: ["Fintech"],
      batch: "W24",
    });
    expect(queryCalls).toBe(2);
  });

  it("skips hits with no website", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("ycombinator.com/companies")) return { ok: true, text: async () => PAGE_HTML };
        return {
          ok: true,
          json: async () => ({ hits: [algoliaHit({ website: "" }), algoliaHit({ name: "HasSite" })], page: 0, nbPages: 1 }),
        };
      }),
    );

    const companies = await fetchYcCompanies();
    expect(companies.map((c) => c.name)).toEqual(["HasSite"]);
  });

  it("throws a clear error if AlgoliaOpts can't be found on the companies page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "<html>no algolia here</html>" })));
    await expect(fetchYcCompanies()).rejects.toThrow(/AlgoliaOpts/);
  });
});
