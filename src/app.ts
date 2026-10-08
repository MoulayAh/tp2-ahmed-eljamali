import express, { type ErrorRequestHandler } from "express";
import { roomsRouter } from "./routes/rooms.js";
import { bookingsRouter } from "./routes/bookings.js";

// Sans ce gestionnaire, Express repond par une page HTML qui contient la pile d'appels et
// les chemins du serveur (URL mal encodee, corps JSON invalide...).
const jsonErrors: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({ error: status === 500 ? "erreur interne" : "requete invalide" });
};

/** Construit l'application Express : routes et gestion des erreurs en JSON. */
export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/rooms", roomsRouter);
  app.use("/bookings", bookingsRouter);
  app.use(jsonErrors);
  return app;
}
