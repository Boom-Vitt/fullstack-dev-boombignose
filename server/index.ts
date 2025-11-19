import "./env";
import "./types";

import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

import { prisma } from "./prisma";
import { manualRouter } from "./manualRoutes";
import { authRouter } from "./authRoutes";
import { chatRouter } from "./chatRoutes";

const PORT = Number(process.env.PORT) || 4000;

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ status: "error", error: (error as Error).message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/manuals", manualRouter);
app.use("/api/chats", chatRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.path} not found` });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
);

async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

