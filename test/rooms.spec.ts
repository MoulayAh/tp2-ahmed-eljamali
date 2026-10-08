import { describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";

async function call(path: string) {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: (await res.json()) as any };
  } finally {
    server.close();
  }
}

describe("GET /health", () => {
  it("repond ok", async () => {
    const res = await call("/health");
    expect(res).toEqual({ status: 200, body: { ok: true } });
  });
});

describe("GET /rooms", () => {
  it("renvoie le catalogue", async () => {
    const res = await call("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(4);
  });
});

describe("GET /rooms/:id", () => {
  it("renvoie la salle et ses reservations", async () => {
    const res = await call("/rooms/salle-a");
    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe("salle-a");
    expect(res.body.bookings.every((b: { roomId: string }) => b.roomId === "salle-a")).toBe(true);
  });

  it("renvoie 404 pour une salle inconnue", async () => {
    const res = await call("/rooms/cave");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("salle inconnue");
  });
});

describe("GET /rooms/:id/availability", () => {
  it("renvoie les creneaux libres autour d'une reservation", async () => {
    const res = await call("/rooms/salle-a/availability?date=2026-10-05");
    expect(res).toEqual({
      status: 200,
      body: {
        roomId: "salle-a",
        date: "2026-10-05",
        slots: [
          { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-05T09:00:00.000Z" },
          { startsAt: "2026-10-05T11:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" }
        ]
      }
    });
  });

  it("renvoie le jour entier quand il n'y a pas de reservation", async () => {
    const res = await call("/rooms/salle-a/availability?date=2026-10-07");
    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([
      { startsAt: "2026-10-07T00:00:00.000Z", endsAt: "2026-10-08T00:00:00.000Z" }
    ]);
  });

  it("renvoie les creneaux de l'amphi le 2026-10-06", async () => {
    const res = await call("/rooms/amphi/availability?date=2026-10-06");
    expect(res.status).toBe(200);
    expect(res.body.roomId).toBe("amphi");
    expect(res.body.slots).toEqual([
      { startsAt: "2026-10-06T00:00:00.000Z", endsAt: "2026-10-06T14:00:00.000Z" },
      { startsAt: "2026-10-06T17:00:00.000Z", endsAt: "2026-10-07T00:00:00.000Z" }
    ]);
  });

  it("renvoie 404 pour une salle inconnue", async () => {
    const res = await call("/rooms/cave/availability?date=2026-10-05");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("salle inconnue");
  });

  it("renvoie 404 avant 400 quand salle et date sont invalides", async () => {
    const res = await call("/rooms/cave/availability");
    expect(res.status).toBe(404);
  });

  it.each([
    ["sans date", ""],
    ["avec un horodatage", "?date=2026-10-05T10:00:00Z"],
    ["avec une date impossible", "?date=2026-02-30"],
    ["avec une date repetee", "?date=a&date=b"]
  ])("renvoie 400 %s", async (_name, query) => {
    const res = await call(`/rooms/salle-a/availability${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
