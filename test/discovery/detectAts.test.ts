import { afterEach, describe, expect, it, vi } from "vitest";
import { detectAts } from "../../src/discovery/detectAts.js";

function stubFetchText(byPath: Record<string, string | null>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname || "/";
      const body = byPath[path];
      if (body === null || body === undefined) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, text: async () => body };
    }),
  );
}

describe("detectAts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("finds an Ashby link on the /careers page and extracts platform + slug", async () => {
    stubFetchText({
      "/careers": '<a href="https://jobs.ashbyhq.com/ramp/0907ae2a-1234">Open roles</a>',
    });
    await expect(detectAts("https://ramp.com")).resolves.toEqual({ platform: "ashby", slug: "ramp" });
  });

  it("falls back to /jobs when /careers 404s", async () => {
    stubFetchText({
      "/careers": null,
      "/jobs": '<a href="https://boards.greenhouse.io/acme">Careers</a>',
    });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "greenhouse", slug: "acme" });
  });

  it("falls back to the homepage when neither /careers nor /jobs match", async () => {
    stubFetchText({
      "/careers": null,
      "/jobs": null,
      "/": '<a href="https://jobs.lever.co/acme">Join us</a>',
    });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "lever", slug: "acme" });
  });

  it("returns null when no candidate path matches any known ATS pattern", async () => {
    stubFetchText({ "/careers": "<html>no ats here</html>", "/jobs": null, "/": "<html>nothing</html>" });
    await expect(detectAts("https://acme.com")).resolves.toBeNull();
  });

  it("returns null when every candidate path errors", async () => {
    stubFetchText({ "/careers": null, "/jobs": null, "/": null });
    await expect(detectAts("https://dead-site.com")).resolves.toBeNull();
  });

  it("lowercases the extracted slug and tolerates a trailing slash on the input website", async () => {
    stubFetchText({ "/careers": '<a href="https://jobs.lever.co/ACME-Inc">Careers</a>' });
    await expect(detectAts("https://acme.com/")).resolves.toEqual({ platform: "lever", slug: "acme-inc" });
  });

  it("detects a Teamtailor link", async () => {
    stubFetchText({ "/careers": '<a href="https://acme.teamtailor.com/jobs">Open roles</a>' });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "teamtailor", slug: "acme" });
  });

  it("detects a Pinpoint link", async () => {
    stubFetchText({ "/careers": '<a href="https://acme.pinpointhq.com/">Careers</a>' });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "pinpoint", slug: "acme" });
  });

  it("detects a Rippling link", async () => {
    stubFetchText({ "/careers": '<a href="https://ats.rippling.com/acme-job-board">Careers</a>' });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "rippling", slug: "acme-job-board" });
  });

  it("detects a Jobvite link", async () => {
    stubFetchText({ "/careers": '<a href="https://jobs.jobvite.com/careers/acme/jobs">Careers</a>' });
    await expect(detectAts("https://acme.com")).resolves.toEqual({ platform: "jobvite", slug: "acme" });
  });
});
