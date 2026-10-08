import ok, { fail } from "./result.js";
import type { Result } from "./result.js";

const DAY_MS = 86400000;

export default function parseDay(date: unknown): Result<{ date: string; start: number; end: number }> {
  if (typeof date !== "string") {
    return fail("date manquante ou invalide : format attendu YYYY-MM-DD");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail("date invalide : format attendu YYYY-MM-DD");
  }
  const start = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== date) {
    return fail("date impossible dans le calendrier");
  }
  return ok({ date, start, end: start + DAY_MS });
}
