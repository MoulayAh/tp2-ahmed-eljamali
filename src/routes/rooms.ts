import { Router } from "express";
import { rooms, findRoom, bookingsForRoom } from "../store.js";
import parseDay from "../lib/day.js";
import freeSlots from "../lib/availability.js";

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
  const room = findRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: "salle inconnue" });
    return;
  }
  const day = parseDay(typeof req.query.date === "string" ? req.query.date : undefined);
  if (!day.ok) {
    res.status(400).json({ error: day.error });
    return;
  }
  const { date, start, end } = day.value;
  res.json({ roomId: room.id, date, slots: freeSlots(bookingsForRoom(room.id), start, end) });
});
