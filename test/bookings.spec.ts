import { describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";

async function call(path: string, init?: RequestInit) {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return { status: res.status, body: (await res.json()) as any };
  } finally {
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

  it("cree une reservation et la facture au tarif de la salle", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "equipe-prix",
      people: 3,
      startsAt: "2026-11-09T09:00:00Z",
      endsAt: "2026-11-09T11:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ roomId: "salle-a", who: "equipe-prix", price: 50 });
    expect(res.body.booking.id).toMatch(/^bk-\d+$/);
  });

  it("facture la majoration de week-end en nombre", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "equipe-weekend",
      people: 3,
      startsAt: "2026-11-14T09:00:00Z",
      endsAt: "2026-11-14T11:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.price).toBe(70);
  });

  it("refuse un creneau qui chevauche une reservation existante", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "intrus",
      people: 2,
      startsAt: "2026-10-05T10:00:00Z",
      endsAt: "2026-10-05T12:00:00Z"
    });
    expect(res.status).toBe(409);
    expect(res.body.conflictsWith).toBe("bk-1001");
  });

  it("refuse un champ texte vide", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "  ",
      people: 2,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("who");
  });

  it("refuse un nombre de personnes non entier", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2.5,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("people");
  });

  it("refuse une date sans fuseau horaire (les dates circulent en UTC)", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T09:00:00",
      endsAt: "2026-11-02T10:00:00"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("startsAt");
  });
});

describe("GET /bookings", () => {
  it("liste toutes les reservations", async () => {
    const res = await call("/bookings");
    expect(res.status).toBe(200);
    expect(res.body.bookings.map((b: { id: string }) => b.id)).toContain("bk-1001");
  });

  it("filtre par salle", async () => {
    const res = await call("/bookings?roomId=amphi");
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBeGreaterThan(0);
    expect(res.body.bookings.every((b: { roomId: string }) => b.roomId === "amphi")).toBe(true);
  });
});

describe("DELETE /bookings/:id", () => {
  it("annule une reservation existante", async () => {
    const created = await post({
      roomId: "salle-b",
      who: "a-annuler",
      people: 2,
      startsAt: "2026-11-20T09:00:00Z",
      endsAt: "2026-11-20T10:00:00Z"
    });
    const id = created.body.booking.id;
    const res = await call(`/bookings/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(id);
    const again = await call(`/bookings/${id}`, { method: "DELETE" });
    expect(again.status).toBe(404);
  });
});
