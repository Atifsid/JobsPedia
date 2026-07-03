import { describe, it, expect } from "vitest";
import { deriveSeniority } from "../src/seniority.js";

describe("deriveSeniority", () => {
  it("returns mid for a title with no seniority signal", () => {
    expect(deriveSeniority("Software Engineer")).toBe("mid");
  });

  it("detects senior", () => {
    expect(deriveSeniority("Senior Software Engineer")).toBe("senior");
    expect(deriveSeniority("Sr. Backend Engineer")).toBe("senior");
  });

  it("detects staff", () => {
    expect(deriveSeniority("Staff Software Engineer")).toBe("staff");
  });

  it("detects principal", () => {
    expect(deriveSeniority("Principal Engineer")).toBe("principal");
  });

  it("detects lead", () => {
    expect(deriveSeniority("Lead Product Engineer")).toBe("lead");
  });

  it("detects entry-level signals", () => {
    expect(deriveSeniority("Junior Developer")).toBe("entry");
    expect(deriveSeniority("Associate Software Engineer")).toBe("entry");
    expect(deriveSeniority("New Grad Software Engineer")).toBe("entry");
  });

  it("detects internships", () => {
    expect(deriveSeniority("Software Engineering Intern")).toBe("internship");
  });

  it("prioritizes principal over senior when both appear", () => {
    expect(deriveSeniority("Senior Principal Engineer")).toBe("principal");
  });

  it("prioritizes staff over senior when both appear", () => {
    expect(deriveSeniority("Senior Staff Engineer")).toBe("staff");
  });
});
