/**
 * Validation des charges utiles entrantes.
 */
export class ValidationError extends Error {
  status = 400;
}

export function requireString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`champ manquant ou vide : ${field}`);
  }
  return value;
}

// ISO 8601 avec fuseau explicite : sans lui, Date.parse lit l'heure locale du serveur.
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function requireDate(payload: Record<string, unknown>, field: string): string {
  const value = requireString(payload, field);
  if (!ISO_WITH_ZONE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`date invalide : ${field}`);
  }
  return value;
}

export function requirePositiveInt(payload: Record<string, unknown>, field: string): number {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`entier positif attendu : ${field}`);
  }
  return value;
}
