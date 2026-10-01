import { Router } from "express";
import { ContentStatus, Plan, UsageStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { generateHashtags, generateIdeas } from "../services/ai";
import { ensureCanCreateBrand, ensurePlan, finishGeneration, PLAN_LIMITS, reserveGeneration } from "../services/usage";
import { asyncHandler, ApiError } from "../utils/http";
import { platformSchema } from "../validators/content";

const router = Router();

const brandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  businessName: z.string().max(150).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  industry: z.string().max(150).optional().nullable(),
  targetAudience: z.string().max(1000).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  email: z.string().email().max(254).optional().nullable().or(z.literal("")),
  location: z.string().max(250).optional().nullable(),
  brandVoice: z.string().max(1000).optional().nullable(),
  commonCta: z.string().max(500).optional().nullable(),
  keywords: z.string().max(1000).optional().nullable(),
  isDefault: z.boolean().optional(),
});

router.get(
  "/user/profile",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) throw new ApiError(404, "User not found.");
    res.json({ success: true, user });
  }),
);

router.put(
  "/user/profile",
  asyncHandler(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: input.name },
      select: { id: true, name: true, email: true },
    });
    res.json({ success: true, user });
  }),
);

router.get(
  "/brands",
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
    res.json({ success: true, brands });
  }),
);

router.post(
  "/brands",
  asyncHandler(async (req, res) => {
    const input = brandSchema.parse(req.body);
    await ensureCanCreateBrand(req.user!.id);
    const existingCount = await prisma.brand.count({ where: { userId: req.user!.id } });
    const brand = await prisma.$transaction(async (tx) => {
      if (input.isDefault || existingCount === 0) {
        await tx.brand.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
      }
      return tx.brand.create({
        data: { ...input, isDefault: input.isDefault ?? existingCount === 0, userId: req.user!.id },
      });
    });
    res.status(201).json({ success: true, brand });
  }),
);

router.get(
  "/brands/:id",
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!brand) throw new ApiError(404, "Brand profile not found.");
    res.json({ success: true, brand });
  }),
);

router.put(
  "/brands/:id",
  asyncHandler(async (req, res) => {
    const input = brandSchema.partial().parse(req.body);
    const current = await prisma.brand.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!current) throw new ApiError(404, "Brand profile not found.");
    const brand = await prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.brand.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
      return tx.brand.update({
        where: { id: current.id },
        data: { ...input, email: input.email === "" ? null : input.email },
      });
    });
    res.json({ success: true, brand });
  }),
);

router.delete(
  "/brands/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.brand.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (!result.count) throw new ApiError(404, "Brand profile not found.");
    res.json({ success: true, message: "Brand deleted." });
  }),
);

router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const templates = await prisma.template.findMany({ orderBy: [{ isPremium: "asc" }, { category: "asc" }, { name: "asc" }] });
    res.json({ success: true, templates });
  }),
);

router.post(
  "/ideas/generate",
  asyncHandler(async (req, res) => {
    const input = z.object({
      industry: z.string().trim().min(1).max(200),
      platform: platformSchema,
      audience: z.string().max(500).optional(),
      goal: z.string().max(300).optional(),
    }).parse(req.body);
    const usage = await reserveGeneration(req.user!.id, "ideas.generate");
    try {
      const result = await generateIdeas(input, req.user!.id);
      await finishGeneration(usage.id, true, result.tokensUsed);
      res.json({ success: true, ideas: result.ideas });
    } catch (error) {
      await finishGeneration(usage.id, false);
      throw error;
    }
  }),
);

router.post(
  "/hashtags/generate",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, [Plan.CREATOR, Plan.BUSINESS, Plan.AGENCY], "Hashtag generation");
    const input = z.object({
      topic: z.string().trim().min(1).max(300),
      industry: z.string().max(200).optional(),
      platform: platformSchema,
    }).parse(req.body);
    const usage = await reserveGeneration(req.user!.id, "hashtags.generate");
    try {
      const result = await generateHashtags(input, req.user!.id);
      await finishGeneration(usage.id, true, result.tokensUsed);
      res.json({ success: true, hashtags: result.hashtags });
    } catch (error) {
      await finishGeneration(usage.id, false);
      throw error;
    }
  }),
);

router.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, [Plan.CREATOR, Plan.BUSINESS, Plan.AGENCY], "Content calendar");
    const { from, to } = z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(req.query);
    const posts = await prisma.calendarPost.findMany({
      where: {
        userId: req.user!.id,
        ...(from || to ? { scheduledAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      orderBy: { scheduledAt: "asc" },
    });
    res.json({ success: true, posts });
  }),
);

router.post(
  "/calendar",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, [Plan.CREATOR, Plan.BUSINESS, Plan.AGENCY], "Content calendar");
    const input = z.object({
      title: z.string().trim().min(1).max(200),
      text: z.string().trim().min(1).max(8000),
      platform: platformSchema,
      scheduledAt: z.string().datetime(),
      contentId: z.string().optional(),
      status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]).optional(),
    }).parse(req.body);
    if (input.contentId) {
      const owned = await prisma.content.findFirst({ where: { id: input.contentId, userId: req.user!.id } });
      if (!owned) throw new ApiError(404, "Linked content not found.");
    }
    const post = await prisma.calendarPost.create({
      data: { ...input, userId: req.user!.id, scheduledAt: new Date(input.scheduledAt), status: input.status ?? "SCHEDULED" },
    });
    res.status(201).json({ success: true, post });
  }),
);

router.put(
  "/calendar/:id",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, [Plan.CREATOR, Plan.BUSINESS, Plan.AGENCY], "Content calendar");
    const input = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      text: z.string().trim().min(1).max(8000).optional(),
      platform: platformSchema.optional(),
      scheduledAt: z.string().datetime().optional(),
      status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]).optional(),
    }).parse(req.body);
    const existing = await prisma.calendarPost.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, "Calendar post not found.");
    const post = await prisma.calendarPost.update({
      where: { id: existing.id },
      data: { ...input, ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}) },
    });
    res.json({ success: true, post });
  }),
);

router.delete(
  "/calendar/:id",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, [Plan.CREATOR, Plan.BUSINESS, Plan.AGENCY], "Content calendar");
    const result = await prisma.calendarPost.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (!result.count) throw new ApiError(404, "Calendar post not found.");
    res.json({ success: true, message: "Calendar post deleted." });
  }),
);

router.get(
  "/subscription",
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: req.user!.id } });
    const plan = subscription?.plan ?? Plan.FREE;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [used, saved, brands] = await Promise.all([
      prisma.aIUsage.aggregate({
        where: { userId: req.user!.id, createdAt: { gte: monthStart }, status: { in: [UsageStatus.PENDING, UsageStatus.SUCCESS] } },
        _sum: { generationCount: true },
      }),
      prisma.content.count({ where: { userId: req.user!.id, isSaved: true } }),
      prisma.brand.count({ where: { userId: req.user!.id } }),
    ]);
    res.json({
      success: true,
      subscription: {
        plan,
        limits: PLAN_LIMITS[plan],
        usage: {
          generations: used._sum.generationCount ?? 0,
          savedPosts: saved,
          brands,
        },
        availablePlans: Object.values(Plan),
        billingEnabled: false,
      },
    });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const [generated, saved, favorites, platforms, types, usage, recent, monthly] = await Promise.all([
      prisma.content.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.content.count({ where: { userId, isSaved: true } }),
      prisma.favorite.count({ where: { content: { userId } } }),
      prisma.content.groupBy({ by: ["platform"], where: { userId }, _count: { _all: true } }),
      prisma.content.groupBy({ by: ["contentType"], where: { userId }, _count: { _all: true } }),
      prisma.aIUsage.aggregate({
        where: { userId, createdAt: { gte: since }, status: UsageStatus.SUCCESS },
        _sum: { generationCount: true, tokensUsed: true },
      }),
      prisma.content.findMany({ where: { userId }, take: 5, orderBy: { createdAt: "desc" } }),
      prisma.content.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true },
      }),
    ]);
    const activity = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return {
        month: date.toLocaleString("en", { month: "short" }),
        count: monthly.filter((item) => item.createdAt.getMonth() === date.getMonth() && item.createdAt.getFullYear() === date.getFullYear()).length,
      };
    });
    res.json({
      success: true,
      analytics: {
        generatedThisMonth: generated,
        savedPosts: saved,
        favoritePosts: favorites,
        aiUsage: usage._sum.generationCount ?? 0,
        tokensUsed: usage._sum.tokensUsed ?? 0,
        byPlatform: platforms.map((item) => ({ name: item.platform, count: item._count._all })),
        byContentType: types.map((item) => ({ name: item.contentType, count: item._count._all })),
        monthlyActivity: activity,
        recent,
      },
    });
  }),
);

export default router;
