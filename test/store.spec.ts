import { describe, it, expect } from "vitest";
import { rooms, findRoom, bookingsForRoom, nextBookingId } from "../src/store.js";

// On teste le vrai store (lecture seule) : un double ne prouve rien sur le code reel.
describe("store", () => {
  it("expose le catalogue de salles", () => {
    expect(rooms.map((r) => r.id)).toEqual(["amphi", "salle-a", "salle-b", "labo"]);
  });

  it("retrouve une salle par son identifiant", () => {
    const room = findRoom("salle-a");
    expect(room?.id).toBe("salle-a");
    expect(room?.capacity).toBe(12);
  });

  it("renvoie undefined pour une salle inconnue", () => {
    expect(findRoom("cave")).toBeUndefined();
  });

  it("ne renvoie que les reservations de la salle demandee", () => {
    const amphi = bookingsForRoom("amphi");
    expect(amphi.length).toBeGreaterThan(0);
    expect(amphi.every((b) => b.roomId === "amphi")).toBe(true);
  });

  it("ne retourne aucune reservation pour une salle sans reservation", () => {
    expect(bookingsForRoom("salle-b")).toHaveLength(0);
  });

  it("genere des identifiants de reservation uniques et croissants", () => {
    const a = nextBookingId();
    const b = nextBookingId();
    expect(a).toMatch(/^bk-\d+$/);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
  });
});
