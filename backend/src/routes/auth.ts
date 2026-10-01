import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../db";
import { clearSessionCookie, requireAuth, setSessionCookie } from "../middleware/auth";
import { asyncHandler, ApiError } from "../utils/http";

const router = Router();
const credentials = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = credentials.extend({ name: z.string().trim().min(2).max(100) }).parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError(409, "An account with this email already exists.");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        subscription: { create: { plan: "FREE" } },
      },
      select: { id: true, name: true, email: true },
    });
    setSessionCookie(res, user.id);
    res.status(201).json({ success: true, user });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new ApiError(401, "Email or password is incorrect.");
    }
    setSessionCookie(res, user.id);
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  }),
);

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: "Logged out" });
});

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email().transform((value) => value.toLowerCase()) }).parse(req.body);
    const isDevelopment = process.env.NODE_ENV !== "production";
    const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (!isDevelopment && !smtpReady) {
      throw new ApiError(503, "Password reset email is not configured on this server.");
    }
    const user = await prisma.user.findUnique({ where: { email } });
    let developmentResetToken: string | undefined;
    if (user) {
      const token = randomBytes(32).toString("hex");
      developmentResetToken = token;
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      if (!isDevelopment) {
        const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/forgot-password?token=${encodeURIComponent(token)}`;
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: Number(process.env.SMTP_PORT ?? 587) === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from: process.env.EMAIL_FROM ?? "PostPilot AI <no-reply@localhost>",
            to: user.email,
            subject: "Reset your PostPilot AI password",
            text: `Use this link within 30 minutes to reset your password: ${resetUrl}`,
          });
        } catch (error) {
          await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex") } });
          console.error("Password reset email could not be sent", error);
          throw new ApiError(502, "Password reset email could not be sent. Please try again later.");
        }
      }
    }
    const response: { success: boolean; message: string; resetToken?: string } = {
      success: true,
      message: "If an account exists for that email, password reset instructions will be sent.",
    };
    if (isDevelopment && developmentResetToken) {
      response.resetToken = developmentResetToken;
    }
    res.json(response);
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const input = z.object({
      token: z.string().min(32).max(128),
      password: z.string().min(8).max(128),
    }).parse(req.body);
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new ApiError(400, "Password reset token is invalid or expired.");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.updateMany({
        where: { userId: reset.userId, id: { not: reset.id }, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    res.json({ success: true, message: "Password has been reset." });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, subscription: { select: { plan: true } } },
    });
    if (!user) throw new ApiError(401, "Account no longer exists.");
    res.json({ success: true, user });
  }),
);

router.put(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new ApiError(400, "Current password is incorrect.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
    });
    res.json({ success: true, message: "Password updated." });
  }),
);

export default router;
