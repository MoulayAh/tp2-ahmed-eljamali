import { describe, it, expect } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { bookings } from "../src/store.js";
import type { Booking, Room } from "../src/store.js";
import { isValidDay, freeSlots } from "../src/lib/availability.js";
import type { Slot } from "../src/lib/availability.js";

interface ApiBody {
  error?: string;
  room?: Room;
  date?: string;
  slots?: Slot[];
}

async function call(path: string, init?: RequestInit): Promise<{ status: number; body: ApiBody }> {
  const app = createApp();
  // On attend que le port soit reellement ouvert, et on ferme les connexions keep-alive :
  // sinon un serveur suivant peut recuperer le meme port et une socket morte.
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: { connection: "close", ...(init?.headers ?? {}) }
    });
    return { status: res.status, body: (await res.json()) as ApiBody };
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

describe("isValidDay", () => {
  it("accepte une date calendaire valide", () => {
    expect(isValidDay("2026-10-05")).toBe(true);
  });

  it("refuse un mois ou un jour hors bornes", () => {
    expect(isValidDay("2026-13-99")).toBe(false);
    expect(isValidDay("2026-00-10")).toBe(false);
  });

  it("refuse un jour non zero-padde", () => {
    expect(isValidDay("2026-10-5")).toBe(false);
  });

  it("refuse une date qui n'existe pas dans le calendrier", () => {
    expect(isValidDay("2026-02-30")).toBe(false);
  });

  it("refuse du texte libre", () => {
    expect(isValidDay("la semaine prochaine")).toBe(false);
  });

  it("refuse une date suivie d'un saut de ligne", () => {
    expect(isValidDay("2026-10-05\n")).toBe(false);
    expect(isValidDay("2026-10-05\r")).toBe(false);
    expect(isValidDay("2026-10-05\r\n")).toBe(false);
  });
});

describe("freeSlots", () => {
  it("decoupe une journee vide en 12 creneaux ordonnes", () => {
    const slots = freeSlots([], "2026-10-05");
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({
      startsAt: "2026-10-05T08:00:00Z",
      endsAt: "2026-10-05T09:00:00Z"
    });
    expect(slots[11]).toEqual({
      startsAt: "2026-10-05T19:00:00Z",
      endsAt: "2026-10-05T20:00:00Z"
    });
    expect(slots.map((s) => s.startsAt)).toEqual([...slots].map((s) => s.startsAt).sort());
  });

  it("retire les creneaux couverts par les reservations d'une salle", () => {
    const slots = freeSlots(
      bookings.filter((b) => b.roomId === "salle-a"),
      "2026-10-05"
    );
    expect(slots).toHaveLength(10);
    expect(slots.map((s) => s.startsAt)).not.toContain("2026-10-05T09:00:00Z");
    expect(slots.map((s) => s.startsAt)).not.toContain("2026-10-05T10:00:00Z");
    expect(slots.map((s) => s.startsAt)).toContain("2026-10-05T11:00:00Z");
  });

  it("retire les trois creneaux de la conference de l'amphi", () => {
    const slots = freeSlots(
      bookings.filter((b) => b.roomId === "amphi"),
      "2026-10-06"
    );
    expect(slots).toHaveLength(9);
    expect(slots.map((s) => s.startsAt)).toContain("2026-10-06T13:00:00Z");
    expect(slots.map((s) => s.startsAt)).toContain("2026-10-06T17:00:00Z");
  });

  it("garde le creneau qui commence pile a la fin d'une reservation", () => {
    const scrape: Booking[] = [
      {
        id: "bk-test",
        roomId: "salle-b",
        who: "moi",
        people: 1,
        startsAt: "2026-10-05T08:00:00Z",
        endsAt: "2026-10-05T09:00:00Z",
        price: 0
      }
    ];
    const slots = freeSlots(scrape, "2026-10-05");
    expect(slots.map((s) => s.startsAt)).toContain("2026-10-05T09:00:00Z");
  });
});

describe("GET /rooms/:id/availability", () => {
  it("renvoie 404 pour une salle inconnue", async () => {
    const res = await call("/rooms/cave/availability?date=2026-10-05");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "salle inconnue" });
  });

  it("refuse une date absente", async () => {
    const res = await call("/rooms/salle-a/availability");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "champ manquant ou vide : date" });
  });

  it("refuse une date mal formee ou impossible", async () => {
    for (const date of ["2026-13-99", "2026-10-5", "la semaine prochaine"]) {
      const res = await call(`/rooms/salle-a/availability?date=${encodeURIComponent(date)}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "date invalide : date" });
    }
  });

  it("refuse une date suivie d'un saut de ligne", async () => {
    const res = await call("/rooms/salle-a/availability?date=2026-10-05%0A");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "date invalide : date" });
  });

  it("renvoie 12 creneaux pour une journee sans reservation", async () => {
    const res = await call("/rooms/salle-b/availability?date=2026-10-05");
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(12);
    expect(res.body.slots?.[0]).toEqual({
      startsAt: "2026-10-05T08:00:00Z",
      endsAt: "2026-10-05T09:00:00Z"
    });
    expect(res.body.slots?.[11]).toEqual({
      startsAt: "2026-10-05T19:00:00Z",
      endsAt: "2026-10-05T20:00:00Z"
    });
  });

  it("ecarte les creneaux occupes de salle-a et garde la borne haute", async () => {
    const res = await call("/rooms/salle-a/availability?date=2026-10-05");
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(10);
    const starts = res.body.slots?.map((s) => s.startsAt) ?? [];
    expect(starts).not.toContain("2026-10-05T09:00:00Z");
    expect(starts).not.toContain("2026-10-05T10:00:00Z");
    expect(starts).toContain("2026-10-05T11:00:00Z");
  });

  it("ecarte les creneaux occupes de l'amphi", async () => {
    const res = await call("/rooms/amphi/availability?date=2026-10-06");
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(9);
    const starts = res.body.slots?.map((s) => s.startsAt) ?? [];
    expect(starts).not.toContain("2026-10-06T14:00:00Z");
    expect(starts).not.toContain("2026-10-06T15:00:00Z");
    expect(starts).not.toContain("2026-10-06T16:00:00Z");
    expect(starts).toContain("2026-10-06T13:00:00Z");
    expect(starts).toContain("2026-10-06T17:00:00Z");
  });
});
