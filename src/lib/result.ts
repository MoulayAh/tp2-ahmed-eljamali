export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export default function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
