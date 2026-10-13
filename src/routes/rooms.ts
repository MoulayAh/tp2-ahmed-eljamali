import { Router } from "express";
import { rooms, findRoom, bookingsForRoom } from "../store.js";
import { isValidDay, freeSlots } from "../lib/availability.js";
import { ValidationError } from "../lib/validate.js";

export const roomsRouter = Router();

roomsRouter.get("/", (_req, res) => {
  res.json({ rooms });
});

roomsRouter.get("/:id", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: "salle inconnue" });
    return;
  }
  res.json({ room, bookings: bookingsForRoom(room.id) });
});

roomsRouter.get("/:id/availability", (req, res) => {
  try {
    const date = req.query.date;
    if (typeof date !== "string" || date.trim() === "") {
      throw new ValidationError("champ manquant ou vide : date");
    }
    if (!isValidDay(date)) {
      throw new ValidationError("date invalide : date");
    }

    const room = findRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "salle inconnue" });
      return;
    }

    res.json({ room, date, slots: freeSlots(bookingsForRoom(room.id), date) });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});
