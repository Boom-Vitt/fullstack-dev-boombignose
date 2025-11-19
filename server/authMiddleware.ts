import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "session_token";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session?.token) {
        await prisma.session.delete({ where: { token: session.token } });
      }
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({ message: "Session expired" });
      return;
    }

    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.cookies?.[SESSION_COOKIE_NAME]) {
    return next();
  }

  requireAuth(req, _res, next).catch(next);
}