import { describe, it, expect } from "vitest";
import { requireString, requireDate, requirePositiveInt, ValidationError } from "../src/lib/validate.js";

describe("requireString", () => {
  it("renvoie la valeur d'un champ texte", () => {
    expect(requireString({ who: "moi" }, "who")).toBe("moi");
  });

  it("refuse un champ absent, vide ou fait d'espaces", () => {
    expect(() => requireString({}, "who")).toThrow("champ manquant ou vide : who");
    expect(() => requireString({ who: "" }, "who")).toThrow(ValidationError);
    expect(() => requireString({ who: "   " }, "who")).toThrow(ValidationError);
  });

  it("refuse un champ qui n'est pas une chaine", () => {
    expect(() => requireString({ who: 42 }, "who")).toThrow(ValidationError);
  });
});

describe("requireDate", () => {
  it("accepte une date ISO 8601", () => {
    expect(requireDate({ at: "2026-11-02T09:00:00Z" }, "at")).toBe("2026-11-02T09:00:00Z");
  });

  it("refuse une date illisible", () => {
    expect(() => requireDate({ at: "demain" }, "at")).toThrow("date invalide : at");
  });
});

describe("requirePositiveInt", () => {
  it("accepte un entier strictement positif", () => {
    expect(requirePositiveInt({ people: 1 }, "people")).toBe(1);
  });

  it("refuse zero, un negatif, un decimal et une chaine", () => {
    for (const people of [0, -3, 2.5, "4"]) {
      expect(() => requirePositiveInt({ people }, "people")).toThrow("entier positif attendu : people");
    }
  });

  it("porte le statut HTTP 400", () => {
    try {
      requirePositiveInt({}, "people");
    } catch (err) {
      expect((err as ValidationError).status).toBe(400);
    }
    expect.assertions(1);
  });
});
