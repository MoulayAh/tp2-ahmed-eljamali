import { describe, it, expect } from "vitest";
import { rooms, findRoom, bookingsForRoom } from "../src/store.js";

// Le store sera remplace par la vraie base (INFRA-140). En attendant, on teste le vrai
// module : un double ne prouve rien sur le code qui tourne en production.
describe("store", () => {
  it("expose le catalogue de salles", () => {
    expect(rooms.length).toBeGreaterThan(0);
  });

  it("retrouve une salle par son identifiant", () => {
    const room = findRoom("salle-a");
    expect(room?.id).toBe("salle-a");
    expect(room?.capacity).toBe(12);
  });

  it("renvoie undefined pour une salle inconnue", () => {
    expect(findRoom("cave")).toBeUndefined();
  });

  it("ne retourne que les reservations de la salle demandee", () => {
    const found = bookingsForRoom("amphi");
    expect(found.map((b) => b.id)).toContain("bk-1002");
    expect(found.every((b) => b.roomId === "amphi")).toBe(true);
  });

  it("ne retourne aucune reservation pour une salle sans reservation", () => {
    expect(bookingsForRoom("salle-b")).toHaveLength(0);
  });
});
