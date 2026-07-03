/** Round to whole units and drop clearly-bad salary figures (e.g. hourly rates mistaken for annual). */
export function sanitizeSalary(
  min: number | null | undefined,
  max: number | null | undefined,
): { salaryMin: number | null; salaryMax: number | null } {
  const lo = typeof min === "number" && Number.isFinite(min) ? Math.round(min) : null;
  const hi = typeof max === "number" && Number.isFinite(max) ? Math.round(max) : null;
  const valid = (n: number | null) => n !== null && n >= 1000 && n <= 5_000_000;
  const salaryMin = valid(lo) ? lo : null;
  const salaryMax = valid(hi) ? hi : null;
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { salaryMin: salaryMax, salaryMax: salaryMin };
  }
  return { salaryMin, salaryMax };
}
