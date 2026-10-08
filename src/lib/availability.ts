type Slot = { startsAt: string; endsAt: string };

export default function freeSlots(bookings: Slot[], dayStart: number, dayEnd: number): Slot[] {
  const busy = bookings
    .map((b) => [Math.max(Date.parse(b.startsAt), dayStart), Math.min(Date.parse(b.endsAt), dayEnd)])
    .filter(([start, end]) => start < end)
    .sort((a, b) => a[0] - b[0]);

  const slots: Slot[] = [];
  let cursor = dayStart;
  for (const [start, end] of busy) {
    if (start > cursor) {
      slots.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(start).toISOString() });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < dayEnd) {
    slots.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(dayEnd).toISOString() });
  }
  return slots;
}
