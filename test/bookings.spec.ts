import { describe, it, expect } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import type { Booking, Room } from "../src/store.js";

interface ApiBody {
  error?: string;
  conflictsWith?: string;
  cancelled?: string;
  booking?: Booking;
  bookings?: Booking[];
  room?: Room;
  rooms?: Room[];
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

const post = (payload: unknown) =>
  call("/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

describe("POST /bookings", () => {
  it("refuse une salle inconnue", async () => {
    const res = await post({
      roomId: "cave",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse un depassement de capacite", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 40,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse une date invalide", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "la semaine prochaine",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse un creneau qui finit avant de commencer", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T11:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("accepte une reservation qui commence quand la precedente finit", async () => {
    const first = await post({
      roomId: "labo",
      who: "equipe-1",
      people: 4,
      startsAt: "2026-11-03T09:00:00Z",
      endsAt: "2026-11-03T10:00:00Z"
    });
    expect(first.status).toBe(201);

    const second = await post({
      roomId: "labo",
      who: "equipe-2",
      people: 4,
      startsAt: "2026-11-03T10:00:00Z",
      endsAt: "2026-11-03T11:00:00Z"
    });
    expect(second.status).toBe(201);
  });

  it("refuse un creneau qui chevauche une reservation existante", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 2,
      startsAt: "2026-10-05T10:00:00Z",
      endsAt: "2026-10-05T12:00:00Z"
    });
    expect(res.status).toBe(409);
    expect(res.body.conflictsWith).toBe("bk-1001");
  });

  it("refuse un nombre de personnes qui n'est pas un entier positif", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 0,
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("enregistre le prix en nombre, majoration de week-end comprise", async () => {
    // samedi 7 novembre 2026, 2 h dans la salle B a 15 EUR/h
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-07T09:00:00Z",
      endsAt: "2026-11-07T11:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking?.price).toBe(50);
  });
});

describe("GET /bookings", () => {
  it("filtre par salle", async () => {
    const res = await call("/bookings?roomId=amphi");
    expect(res.status).toBe(200);
    expect(res.body.bookings?.length).toBeGreaterThan(0);
    expect(res.body.bookings?.every((b) => b.roomId === "amphi")).toBe(true);
  });
});

describe("DELETE /bookings/:id", () => {
  it("renvoie 404 pour une reservation inconnue", async () => {
    const res = await call("/bookings/bk-0", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("annule une reservation existante", async () => {
    const res = await call("/bookings/bk-1002", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe("bk-1002");
    const after = await call("/bookings?roomId=amphi");
    expect(after.body.bookings?.map((b) => b.id)).not.toContain("bk-1002");
  });
});

describe("GET /rooms", () => {
  it("liste le catalogue", async () => {
    const res = await call("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms?.map((r) => r.id)).toContain("salle-a");
  });

  it("renvoie une salle et ses reservations", async () => {
    const res = await call("/rooms/salle-a");
    expect(res.status).toBe(200);
    expect(res.body.room?.id).toBe("salle-a");
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  it("renvoie 404 pour une salle inconnue", async () => {
    const res = await call("/rooms/cave");
    expect(res.status).toBe(404);
  });
});
