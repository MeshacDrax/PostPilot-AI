import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { decryptAiApiKey, encryptAiApiKey } from "../services/aiCredentials";
import { getAiConfiguration, isAiEncryptionConfigured, testAiConnection } from "../services/ai";
import { testResearchConnection } from "../services/research";
import { asyncHandler, ApiError } from "../utils/http";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const [config, connection] = await Promise.all([
      getAiConfiguration(_req.user!.id).catch((error: unknown) => {
        if (error instanceof ApiError) {
          return {
            configured: false,
            provider: "Unknown provider",
            model: "Unknown model",
            baseUrl: "",
            source: "missing" as const,
            canConfigure: isAiEncryptionConfigured(),
            error: error.message,
          };
        }
        throw error;
      }),
      prisma.aIConnection.findUnique({
        where: { userId: _req.user!.id },
        select: { provider: true, baseUrl: true, model: true },
      }),
    ]);
    res.json({
      success: true,
      ai: {
        configured: config.configured,
        provider: config.provider,
        model: config.model,
        error: config.error ?? null,
        source: config.source,
        canConfigure: config.canConfigure,
        hasAccountConnection: Boolean(connection),
        accountConnection: connection
          ? {
              provider: connection.provider,
              baseUrl: connection.baseUrl,
              model: connection.model,
            }
          : null,
      },
    });
  }),
);

router.put(
  "/connection",
  asyncHandler(async (req, res) => {
    const input = z.object({
      provider: z.enum(["OPENAI", "OPENAI_COMPATIBLE"]),
      apiKey: z.string().trim().max(4000).optional(),
      model: z.string().trim().min(1).max(200),
      baseUrl: z.string().trim().max(500).optional(),
    }).parse(req.body);

    if (!isAiEncryptionConfigured()) {
      throw new ApiError(
        503,
        "AI key encryption is not configured. Set AI_CREDENTIALS_SECRET in the project-root .env and restart the backend.",
      );
    }
    if (input.provider === "OPENAI_COMPATIBLE" && !input.baseUrl) {
      throw new ApiError(400, "Enter your provider's OpenAI-compatible API base URL.");
    }

    let normalizedBaseUrl: string | null = null;
    if (input.provider === "OPENAI_COMPATIBLE") {
      try {
        const url = new URL(input.baseUrl!);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
          throw new Error("Invalid URL.");
        }
        url.search = "";
        url.hash = "";
        normalizedBaseUrl = url.toString().replace(/\/+$/, "");
      } catch {
        throw new ApiError(400, "Enter a valid HTTP(S) API base URL without embedded credentials.");
      }
    }

    const existing = await prisma.aIConnection.findUnique({ where: { userId: req.user!.id } });
    const apiKey = input.apiKey?.replace(/^Bearer\s+/i, "").trim();
    if (!existing && !apiKey) throw new ApiError(400, "An API key is required for a new AI connection.");
    if (input.apiKey !== undefined && !apiKey) throw new ApiError(400, "The API key cannot be blank.");

    if (existing && !input.apiKey) {
      decryptAiApiKey(existing.encryptedApiKey);
    }
    const encryptedApiKey = apiKey
      ? encryptAiApiKey(apiKey)
      : existing?.encryptedApiKey;
    if (!encryptedApiKey) throw new ApiError(400, "An API key is required for a new AI connection.");
    const connection = await prisma.aIConnection.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        provider: input.provider,
        baseUrl: normalizedBaseUrl,
        model: input.model,
        encryptedApiKey,
      },
      update: {
        provider: input.provider,
        baseUrl: normalizedBaseUrl,
        model: input.model,
        ...(apiKey ? { encryptedApiKey } : {}),
      },
      select: { provider: true, baseUrl: true, model: true, updatedAt: true },
    });

    res.json({
      success: true,
      message: "AI provider connection saved securely.",
      connection: { ...connection, hasApiKey: true },
    });
  }),
);

router.delete(
  "/connection",
  asyncHandler(async (req, res) => {
    const result = await prisma.aIConnection.deleteMany({ where: { userId: req.user!.id } });
    res.json({
      success: true,
      message: result.count ? "Account AI connection removed." : "No account AI connection was configured.",
    });
  }),
);

router.post(
  "/test",
  asyncHandler(async (_req, res) => {
    const result = await testAiConnection(_req.user!.id);
    res.json({ success: true, message: "AI provider connection is working.", ...result });
  }),
);

router.get(
  "/research-connection",
  asyncHandler(async (req, res) => {
    const connection = await prisma.researchConnection.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    res.json({
      success: true,
      research: {
        configured: Boolean(connection),
        canConfigure: isAiEncryptionConfigured(),
      },
    });
  }),
);

router.put(
  "/research-connection",
  asyncHandler(async (req, res) => {
    const input = z.object({ apiKey: z.string().trim().max(4000).optional() }).parse(req.body);
    if (!isAiEncryptionConfigured()) {
      throw new ApiError(503, "Key encryption is not configured. Set AI_CREDENTIALS_SECRET in the project-root .env and restart the backend.");
    }
    const existing = await prisma.researchConnection.findUnique({ where: { userId: req.user!.id } });
    const apiKey = input.apiKey?.replace(/^Bearer\s+/i, "").trim();
    if (!existing && !apiKey) throw new ApiError(400, "A Tavily API key is required for a new research connection.");
    if (input.apiKey !== undefined && !apiKey) throw new ApiError(400, "The Tavily API key cannot be blank.");
    if (existing && !apiKey) decryptAiApiKey(existing.encryptedApiKey);
    const encryptedApiKey = apiKey ? encryptAiApiKey(apiKey) : existing?.encryptedApiKey;
    if (!encryptedApiKey) throw new ApiError(400, "A Tavily API key is required for a new research connection.");
    await prisma.researchConnection.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, encryptedApiKey },
      update: apiKey ? { encryptedApiKey } : {},
    });
    res.json({ success: true, message: "Tavily research connection saved securely." });
  }),
);

router.delete(
  "/research-connection",
  asyncHandler(async (req, res) => {
    const result = await prisma.researchConnection.deleteMany({ where: { userId: req.user!.id } });
    res.json({
      success: true,
      message: result.count ? "Tavily research connection removed." : "No Tavily connection was configured.",
    });
  }),
);

router.post(
  "/research-test",
  asyncHandler(async (req, res) => {
    const result = await testResearchConnection(req.user!.id);
    res.json({ success: true, message: "Tavily research connection is working.", ...result });
  }),
);

export default router;
