import { Router } from "express";
import { ContentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { buildVariationTones, generateContent, GenerationInput, transformContent } from "../services/ai";
import { researchContent } from "../services/research";
import { ensureCanSave, ensurePlan, finishGeneration, reserveGeneration } from "../services/usage";
import { asyncHandler, ApiError } from "../utils/http";
import { contentTypeSchema, generationSchema, platformSchema, toneSchema } from "../validators/content";

const router = Router();

async function getBrand(userId: string, brandId?: string) {
  if (!brandId) {
    return prisma.brand.findFirst({ where: { userId, isDefault: true } });
  }
  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) throw new ApiError(404, "Brand profile not found.");
  return brand;
}

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const input = generationSchema.parse(req.body);
    const [brand, template] = await Promise.all([
      getBrand(req.user!.id, input.brandId),
      input.templateId ? prisma.template.findUnique({ where: { id: input.templateId } }) : Promise.resolve(null),
    ]);
    if (input.templateId && !template) throw new ApiError(404, "Template not found.");
    if (template?.isPremium) {
      await ensurePlan(req.user!.id, ["CREATOR", "BUSINESS", "AGENCY"], "Premium templates");
    }
    if (input.variations) {
      await ensurePlan(req.user!.id, ["BUSINESS", "AGENCY"], "Multi-tone variations");
    }
    const tonesToGenerate = input.variations ? buildVariationTones(input.tone) : [input.tone];
    const usage = await reserveGeneration(req.user!.id, "content.generate", tonesToGenerate.length);
    try {
      const research = input.deepResearch
        ? await researchContent({ ...input, brand }, req.user!.id)
        : undefined;
      const promptInput: GenerationInput = {
        ...input,
        description: template ? `${input.description}\n\nTemplate guidance: ${template.prompt}` : input.description,
        tone: tonesToGenerate[0],
        brand,
      };
      const results = await Promise.all(
        tonesToGenerate.map((tone) => generateContent({ ...promptInput, tone }, req.user!.id, research)),
      );
      const texts = results.map((result) => result.text);
      const content = await prisma.content.create({
        data: {
          userId: req.user!.id,
          brandId: brand?.id,
          templateId: template?.id,
          title: input.description.slice(0, 90),
          text: texts[0],
          platform: input.platform,
          contentType: input.contentType,
          tone: tonesToGenerate[0],
          audience: input.audience,
          prompt: input.description,
          ...(research ? { research } : {}),
          variations: {
            create: texts.map((text, index) => ({ text, tone: tonesToGenerate[index] })),
          },
        },
        include: { variations: true },
      });
      await finishGeneration(usage.id, true, results.reduce((sum, result) => sum + (result.tokensUsed ?? 0), 0) || undefined);
      res.status(201).json({
        success: true,
        content,
        generationMode: results.some((result) => result.source === "ai") ? "ai" : "local",
        ...(research ? { research } : {}),
      });
    } catch (error) {
      await finishGeneration(usage.id, false);
      throw error;
    }
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (req, res) => {
    const input = generationSchema.omit({ variations: true }).parse(req.body);
    const brand = await getBrand(req.user!.id, input.brandId);
    const usage = await reserveGeneration(req.user!.id, "content.regenerate");
    try {
      const research = input.deepResearch
        ? await researchContent({ ...input, brand }, req.user!.id)
        : undefined;
      const result = await generateContent({ ...input, brand }, req.user!.id, research);
      await finishGeneration(usage.id, true, result.tokensUsed);
      res.json({ success: true, text: result.text, generationMode: result.source, ...(research ? { research } : {}) });
    } catch (error) {
      await finishGeneration(usage.id, false);
      throw error;
    }
  }),
);

router.post(
  "/improve",
  asyncHandler(async (req, res) => {
    const input = z.object({ text: z.string().min(1).max(8000), tone: toneSchema.optional() }).parse(req.body);
    await ensurePlan(req.user!.id, ["BUSINESS", "AGENCY"], "Advanced AI editing");
    const usage = await reserveGeneration(req.user!.id, "content.improve");
    try {
      const result = await transformContent(input.text, "Improve clarity, impact, and readability while retaining the meaning.", input.tone, req.user!.id);
      await finishGeneration(usage.id, true, result.tokensUsed);
      res.json({ success: true, text: result.text });
    } catch (error) {
      await finishGeneration(usage.id, false);
      throw error;
    }
  }),
);

for (const [path, instruction] of [
  ["shorten", "Shorten this post while preserving its key message."],
  ["expand", "Expand this post with useful detail while preserving its voice."],
] as const) {
  router.post(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const input = z.object({ text: z.string().min(1).max(8000) }).parse(req.body);
      await ensurePlan(req.user!.id, ["BUSINESS", "AGENCY"], "Advanced AI editing");
      const usage = await reserveGeneration(req.user!.id, `content.${path}`);
      try {
        const result = await transformContent(input.text, instruction, undefined, req.user!.id);
        await finishGeneration(usage.id, true, result.tokensUsed);
        res.json({ success: true, text: result.text });
      } catch (error) {
        await finishGeneration(usage.id, false);
        throw error;
      }
    }),
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z.object({
      search: z.string().max(200).optional(),
      platform: platformSchema.optional(),
      contentType: contentTypeSchema.optional(),
      saved: z.enum(["true", "false"]).optional(),
      favorite: z.enum(["true", "false"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(12),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(req.query);
    const where = {
      userId: req.user!.id,
      ...(query.search ? { OR: [{ text: { contains: query.search } }, { title: { contains: query.search } }] } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.contentType ? { contentType: query.contentType } : {}),
      ...(query.saved ? { isSaved: query.saved === "true" } : {}),
      ...(query.favorite === "true" ? { favorite: { isNot: null } } : {}),
      ...(query.favorite === "false" ? { favorite: null } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: { favorite: true },
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.content.count({ where }),
    ]);
    res.json({ success: true, items, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const content = await prisma.content.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { variations: true, favorite: true },
    });
    if (!content) throw new ApiError(404, "Content not found.");
    res.json({ success: true, content });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = z.object({
      title: z.string().max(200).nullable().optional(),
      text: z.string().min(1).max(8000).optional(),
      isSaved: z.boolean().optional(),
      platform: platformSchema.optional(),
      contentType: contentTypeSchema.optional(),
      tone: toneSchema.optional(),
      isFavorite: z.boolean().optional(),
    }).parse(req.body);
    const current = await prisma.content.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!current) throw new ApiError(404, "Content not found.");
    if (input.isSaved && !current.isSaved) await ensureCanSave(req.user!.id);
    const { isFavorite, ...data } = input;
    const content = await prisma.content.update({
      where: { id: current.id },
      data,
      include: { favorite: true },
    });
    if (isFavorite !== undefined) {
      if (isFavorite) {
        await prisma.favorite.upsert({
          where: { contentId: content.id },
          create: { contentId: content.id },
          update: {},
        });
      } else {
        await prisma.favorite.deleteMany({ where: { contentId: content.id } });
      }
    }
    res.json({ success: true, content });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.content.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (!result.count) throw new ApiError(404, "Content not found.");
    res.json({ success: true, message: "Content deleted." });
  }),
);

router.post(
  "/:id/save",
  asyncHandler(async (req, res) => {
    const content = await prisma.content.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!content) throw new ApiError(404, "Content not found.");
    if (!content.isSaved) await ensureCanSave(req.user!.id);
    const updated = await prisma.content.update({ where: { id: content.id }, data: { isSaved: true } });
    res.json({ success: true, content: updated });
  }),
);

router.post(
  "/:id/favorite",
  asyncHandler(async (req, res) => {
    const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
    const content = await prisma.content.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!content) throw new ApiError(404, "Content not found.");
    if (favorite) await prisma.favorite.upsert({ where: { contentId: content.id }, create: { contentId: content.id }, update: {} });
    else await prisma.favorite.deleteMany({ where: { contentId: content.id } });
    res.json({ success: true, favorite });
  }),
);

router.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    await ensurePlan(req.user!.id, ["CREATOR", "BUSINESS", "AGENCY"], "Content calendar");
    const input = z.object({ scheduledAt: z.string().datetime(), title: z.string().max(200).optional() }).parse(req.body);
    const content = await prisma.content.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!content) throw new ApiError(404, "Content not found.");
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt <= new Date()) throw new ApiError(400, "Schedule time must be in the future.");
    const calendarPost = await prisma.calendarPost.create({
      data: {
        userId: req.user!.id,
        contentId: content.id,
        title: input.title ?? content.title ?? content.contentType,
        text: content.text,
        platform: content.platform,
        scheduledAt,
        status: ContentStatus.SCHEDULED,
      },
    });
    res.status(201).json({ success: true, calendarPost });
  }),
);

export default router;
