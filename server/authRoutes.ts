import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "./prisma";
import { asyncHandler } from "./asyncHandler";
import { requireAuth, SESSION_COOKIE_NAME } from "./authMiddleware";

const router = Router();
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const SESSION_DURATION_HOURS = 24;

function buildCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProduction ? "strict" : "lax",
    secure: isProduction,
    maxAge: SESSION_DURATION_HOURS * 60 * 60 * 1000,
    path: "/",
  } as const;
}

async function createSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token: session.token, expiresAt };
}

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const payload = authSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email: payload.data.email.toLowerCase() },
    });

    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(payload.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: payload.data.email.toLowerCase(),
        passwordHash,
      },
    });

    const session = await createSession(user.id);
    res
      .cookie(SESSION_COOKIE_NAME, session.token, buildCookieOptions())
      .status(201)
      .json({ id: user.id, email: user.email });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = authSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: payload.data.email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const match = await bcrypt.compare(payload.data.password, user.passwordHash);
    if (!match) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const session = await createSession(user.id);
    res
      .cookie(SESSION_COOKIE_NAME, session.token, buildCookieOptions())
      .json({ id: user.id, email: user.email });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.session) {
      await prisma.session.delete({ where: { token: req.session.token } });
    }
    res.clearCookie(SESSION_COOKIE_NAME).json({ success: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    res.json({ id: req.user.id, email: req.user.email });
  })
);

export const authRouter = router;
