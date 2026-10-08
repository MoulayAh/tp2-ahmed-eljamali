import { describe, it, expect } from "vitest";
import parseDay from "../src/lib/day.js";
import freeSlots from "../src/lib/availability.js";

describe("parseDay", () => {
  it("accepte une date valide et renvoie les bornes du jour UTC", () => {
    const result = parseDay("2026-10-05");
    expect(result).toEqual({
      ok: true,
      value: {
        date: "2026-10-05",
        start: Date.parse("2026-10-05T00:00:00.000Z"),
        end: Date.parse("2026-10-06T00:00:00.000Z"),
      },
    });
  });

  it("refuse une date impossible dans le calendrier", () => {
    expect(parseDay("2026-02-30").ok).toBe(false);
  });

  it("refuse un mois hors limites", () => {
    expect(parseDay("2026-13-01").ok).toBe(false);
  });

  it("refuse une date sans zeros de remplissage", () => {
    expect(parseDay("2026-1-5").ok).toBe(false);
  });

  it("refuse une date avec heure", () => {
    expect(parseDay("2026-10-05T00:00:00Z").ok).toBe(false);
  });

  it("refuse une chaine vide", () => {
    expect(parseDay("").ok).toBe(false);
  });

  it("refuse une valeur absente", () => {
    expect(parseDay(undefined).ok).toBe(false);
  });

  it("refuse un tableau", () => {
    expect(parseDay(["2026-10-05", "2026-10-06"]).ok).toBe(false);
  });

  it("renvoie un message d'erreur en cas d'echec", () => {
    const result = parseDay("2026-02-30");
    expect(result.ok === false && typeof result.error === "string").toBe(true);
  });
});

describe("freeSlots", () => {
  const dayStart = Date.parse("2026-10-05T00:00:00.000Z");
  const dayEnd = Date.parse("2026-10-06T00:00:00.000Z");
  const wholeDay = { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" };

  it("renvoie le jour entier quand il n'y a aucune reservation", () => {
    expect(freeSlots([], dayStart, dayEnd)).toEqual([wholeDay]);
  });

  it("tronque une reservation a cheval sur minuit cote debut", () => {
    const bookings = [{ startsAt: "2026-10-04T23:00:00Z", endsAt: "2026-10-05T02:00:00Z" }];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T02:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" },
    ]);
  });

  it("tronque une reservation a cheval sur minuit cote fin", () => {
    const bookings = [{ startsAt: "2026-10-05T22:00:00Z", endsAt: "2026-10-06T01:00:00Z" }];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-05T22:00:00.000Z" },
    ]);
  });

  it("compare par instant une reservation avec offset +02:00", () => {
    const bookings = [{ startsAt: "2026-10-05T01:00:00+02:00", endsAt: "2026-10-05T04:00:00+02:00" }];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T02:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" },
    ]);
  });

  it("fusionne les reservations qui se chevauchent", () => {
    const bookings = [
      { startsAt: "2026-10-05T09:00:00Z", endsAt: "2026-10-05T11:00:00Z" },
      { startsAt: "2026-10-05T10:00:00Z", endsAt: "2026-10-05T12:00:00Z" },
    ];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-05T09:00:00.000Z" },
      { startsAt: "2026-10-05T12:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" },
    ]);
  });

  it("fusionne les reservations adjacentes sans creneau de 0 ms", () => {
    const bookings = [
      { startsAt: "2026-10-05T09:00:00Z", endsAt: "2026-10-05T10:00:00Z" },
      { startsAt: "2026-10-05T10:00:00Z", endsAt: "2026-10-05T11:00:00Z" },
    ];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-05T09:00:00.000Z" },
      { startsAt: "2026-10-05T11:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" },
    ]);
  });

  it("ignore une reservation hors du jour", () => {
    const bookings = [
      { startsAt: "2026-10-04T09:00:00Z", endsAt: "2026-10-04T11:00:00Z" },
      { startsAt: "2026-10-06T00:00:00Z", endsAt: "2026-10-06T02:00:00Z" },
    ];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([wholeDay]);
  });

  it("accepte des reservations non triees sans muter l'entree", () => {
    const bookings = [
      { startsAt: "2026-10-05T14:00:00Z", endsAt: "2026-10-05T15:00:00Z" },
      { startsAt: "2026-10-05T09:00:00Z", endsAt: "2026-10-05T10:00:00Z" },
    ];
    const copy = structuredClone(bookings);
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([
      { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-05T09:00:00.000Z" },
      { startsAt: "2026-10-05T10:00:00.000Z", endsAt: "2026-10-05T14:00:00.000Z" },
      { startsAt: "2026-10-05T15:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" },
    ]);
    expect(bookings).toEqual(copy);
  });

  it("renvoie une liste vide quand le jour est entierement reserve", () => {
    const bookings = [{ startsAt: "2026-10-04T20:00:00Z", endsAt: "2026-10-06T03:00:00Z" }];
    expect(freeSlots(bookings, dayStart, dayEnd)).toEqual([]);
  });
});
