import type { Booking } from "../store.js";
import { overlaps } from "./overlap.js";

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const SLOT_MINUTES = 60;

export interface Slot {
  startsAt: string;
  endsAt: string;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function isValidDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?![\s\S])/.test(date)) {
    return false;
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function freeSlots(bookings: Booking[], date: string): Slot[] {
  const slots: Slot[] = [];
  for (
    let minutes = DAY_START_HOUR * 60;
    minutes + SLOT_MINUTES <= DAY_END_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    const startsAt = `${date}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00Z`;
    const endMinutes = minutes + SLOT_MINUTES;
    const endsAt = `${date}T${pad2(Math.floor(endMinutes / 60))}:${pad2(endMinutes % 60)}:00Z`;
    if (!bookings.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))) {
      slots.push({ startsAt, endsAt });
    }
  }
  return slots;
}

export default freeSlots;
