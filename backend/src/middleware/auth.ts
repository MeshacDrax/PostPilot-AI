import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/http";

const COOKIE_NAME = "postpilot_session";

export function setSessionCookie(res: Response, userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  const token = jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET;
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!secret || !token) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Invalid session");
    }
    req.user = { id: payload.sub, email: "", name: "" };
    next();
  } catch {
    next(new ApiError(401, "Session expired or invalid"));
  }
}
