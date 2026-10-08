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
