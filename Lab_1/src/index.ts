import express from "express";
import prisma from "./prisma.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

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

app.listen(PORT, () => {
  console.log(`Lab 1 service: http://localhost:${PORT} (GET /health)`);
});
