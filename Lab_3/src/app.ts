import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import prisma from "./prisma.js";
import dashboardRouter from "./routes/dashboard.js";
import requestsRouter from "./routes/requests.js";
import clientsRouter from "./routes/clients.js";
import devicesRouter from "./routes/devices.js";
import worksRouter from "./routes/works.js";
import partsRouter from "./routes/parts.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Тонкий шар: налаштування Express + mount контролерів.
 * Логіка сторінок — у src/controllers/*, маршрути — у src/routes/*.
 */
export function createApp() {
 const app = express();

 app.set("view engine", "pug");
 app.set("views", path.join(root, "views"));
 app.use(express.static(path.join(root, "public")));
 const uploadsDir = path.join(root, "uploads");
 fs.mkdirSync(uploadsDir, { recursive: true });
 app.use("/uploads", express.static(uploadsDir));
 app.use(express.urlencoded({ extended: false }));

 app.get("/health", async (_req, res) => {
  let db: "up" | "down" = "up";
  try {
   await prisma.$queryRaw`SELECT 1`;
  } catch {
   db = "down";
  }
  res.status(db === "up" ? 200 : 503).json({
   status: db === "up" ? "ok" : "degraded",
   db,
   time: new Date().toISOString(),
  });
 });

 app.use("/", dashboardRouter);
 app.use("/requests", requestsRouter);
 app.use("/clients", clientsRouter);
 app.use("/devices", devicesRouter);
 app.use("/works", worksRouter);
 app.use("/parts", partsRouter);

 app.use((_req, res) => {
  res.status(404).render("errors/404", { nav: "none" });
 });

 app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
   console.error(err);
   res.status(500).render("errors/500", { nav: "none" });
  },
 );

 return app;
}
