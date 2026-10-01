import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentPrompt, buildVariationTones, generateContent, getAiCompletionUrl,
  getAiConfiguration, getPublicAiConfiguration, generateIdeas, testAiConnection, countWords, minimumWordsByLength,
} from "./ai";
import { PLAN_LIMITS } from "./usage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("buildContentPrompt", () => {
  it("includes platform, content settings, audience, and brand information", () => {
    const prompt = buildContentPrompt({
      platform: "LinkedIn",
      contentType: "Educational",
      tone: "Professional",
      length: "Medium",
      description: "Promote our workshop",
      audience: "Small business owners",
      campaignGoal: "Lead generation",
      keyMessage: "The workshop is free.",
      hookStyle: "Question",
      emojiStyle: "None",
      brand: { businessName: "Northstar", brandVoice: "Clear and encouraging" },
    });
    expect(prompt).toContain("Platform: LinkedIn");
    expect(prompt).toContain("Tone: Professional");
    expect(prompt).toContain("Target audience: Small business owners");
    expect(prompt).toContain("Campaign goal: Lead generation");
    expect(prompt).toContain("Key message to preserve: The workshop is free.");
    expect(prompt).toContain("Opening approach: Question");
    expect(prompt).toContain("Emoji use: Do not use emojis");
    expect(prompt).toContain("businessName: Northstar");
  });
});

describe("buildVariationTones", () => {
  it("returns four distinct tones including the selected tone and a punchy option", () => {
    const tones = buildVariationTones("Professional");
    expect(tones).toHaveLength(4);
    expect(new Set(tones).size).toBe(4);
    expect(tones).toContain("Professional");
    expect(tones).toContain("Short and punchy");
  });
});

describe("AI provider configuration", () => {
  it("normalizes completion endpoint URLs without duplicating the route", () => {
    expect(getAiCompletionUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/chat/completions");
    expect(getAiCompletionUrl("https://provider.example/v1/chat/completions/")).toBe("https://provider.example/v1/chat/completions");
  });

  it("reports missing keys without exposing or requiring a real secret", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "https://api.openai.com/v1");
    const configuration = await getPublicAiConfiguration();
    expect(configuration).toMatchObject({
      configured: false,
      provider: "api.openai.com",
      model: "gpt-4o-mini",
    });
    expect(configuration.error).toContain("No AI provider key is configured");
    expect(JSON.stringify(configuration)).not.toContain("apiKey");
  });

  it("surfaces invalid provider configuration instead of silently using a local draft", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "not-a-provider-url");

    await expect(generateContent({
      platform: "Instagram",
      contentType: "Announcement",
      tone: "Friendly",
      length: "Short",
      description: "Test announcement",
    })).rejects.toThrow("AI_BASE_URL is invalid");
  });

  it("normalizes provider keys and accepts OpenAI-compatible responses", async () => {
    vi.stubEnv("AI_API_KEY", "Bearer server-test-key");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1/");
    vi.stubEnv("AI_MODEL", "test-model");
    const shortDraft = "Connection successful. ".repeat(30);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: [{ type: "text", text: shortDraft }] } }],
      usage: { prompt_tokens: 4, completion_tokens: 3 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateContent({
      platform: "LinkedIn",
      contentType: "Announcement",
      tone: "Professional",
      length: "Short",
      description: "Share a launch update",
    });

    expect(result).toMatchObject({ text: shortDraft.trim(), tokensUsed: 7, source: "ai" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer server-test-key" }),
      }),
    );
  });

  it("returns actionable guidance when a provider rejects the key", async () => {
    vi.stubEnv("AI_API_KEY", "invalid-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));

    await expect(generateIdeas({ industry: "Retail", platform: "Instagram" }))
      .rejects.toThrow("The AI provider rejected the API key");
  });

  it("can run a provider connection test without generation quota", async () => {
    vi.stubEnv("AI_API_KEY", "server-test-key");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "PostPilot AI connection successful." } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(testAiConnection()).resolves.toMatchObject({
      provider: "provider.example",
      model: "test-model",
    });
  });
});

describe("generateContent without an AI provider key", () => {
  it("builds a personalized local draft from the submitted business details", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await generateContent({
      platform: "Instagram",
      contentType: "Promotional",
      tone: "Friendly",
      length: "Medium",
      description: "Hand-thrown ceramic mugs in a new spring glaze",
      audience: "people who love a slow morning",
      location: "Portland",
      price: "$32",
      callToAction: "Shop the new collection",
      website: "https://example.com/shop",
      keywords: "handmade pottery, slow living",
      brand: { businessName: "Studio North" },
    });

    expect(result.source).toBe("local");
    expect(result.text).toContain("Hand-thrown ceramic mugs in a new spring glaze");
    expect(result.text).toContain("people who love a slow morning");
    expect(result.text).toContain("Portland · $32");
    expect(result.text).toContain("Shop the new collection.");
    expect(result.text).toContain("https://example.com/shop");
    expect(result.text).toContain("#handmadepottery");
  });

  it("keeps the short word minimum even when it exceeds the X character guide", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await generateContent({
      platform: "X",
      contentType: "Announcement",
      tone: "Professional",
      length: "Short",
      description: "A".repeat(400),
    });

    expect(countWords(result.text)).toBeGreaterThan(50);
    expect(result.text.length).toBeGreaterThan(280);
  });

  it.each([
    ["Short", 51],
    ["Medium", 71],
    ["Long", 101],
  ] as const)("meets the %s local word minimum", async (length, minimum) => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await generateContent({
      platform: "Instagram",
      contentType: "Announcement",
      tone: "Friendly",
      length,
      description: "A new seasonal menu.",
    });

    expect(countWords(result.text)).toBeGreaterThanOrEqual(minimum);
    expect(minimumWordsByLength[length]).toBe(minimum);
  });

  it("uses the advanced creative brief in local drafts", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await generateContent({
      platform: "Instagram",
      contentType: "Promotional",
      tone: "Friendly",
      length: "Medium",
      description: "Small batch coffee roasted each morning",
      campaignGoal: "Engagement",
      keyMessage: "Roasted fresh every day.",
      hookStyle: "Question",
      emojiStyle: "Subtle",
    });

    expect(result.text).toContain("Looking for a new way to explore this offer? ✨");
    expect(result.text).toContain("Roasted fresh every day.");
    expect(result.text).toContain("What do you think? Share your thoughts below.");
  });

  it("revises AI responses until the requested word minimum is met", async () => {
    vi.stubEnv("AI_API_KEY", "test-provider-key");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Too short for the requested post." } }],
        usage: { total_tokens: 10 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: Array.from({ length: 55 }, (_, index) => `useful${index}`).join(" ") } }],
        usage: { total_tokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await generateContent({
      platform: "Instagram",
      contentType: "Educational",
      tone: "Professional",
      length: "Short",
      description: "Share a useful planning tip.",
    });

    expect(countWords(result.text)).toBeGreaterThanOrEqual(51);
    expect(result.tokensUsed).toBe(30);
  });

  it("fails clearly when the AI provider cannot meet the requested word minimum", async () => {
    vi.stubEnv("AI_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Response(JSON.stringify({
      choices: [{ message: { content: "Still too short." } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(generateContent({
      platform: "Instagram",
      contentType: "Educational",
      tone: "Professional",
      length: "Medium",
      description: "Share a useful planning tip.",
    })).rejects.toThrow("fewer than 71 words");
  });
});

describe("subscription limits", () => {
  it("defines finite starter generation and saved-post limits", () => {
    expect(PLAN_LIMITS.FREE.generations).toBe(5);
    expect(PLAN_LIMITS.FREE.savedPosts).toBe(10);
    expect(PLAN_LIMITS.CREATOR.generations).toBe(100);
    expect(PLAN_LIMITS.BUSINESS.generations).toBe(500);
    expect(PLAN_LIMITS.AGENCY.generations).toBeGreaterThan(500);
    expect(PLAN_LIMITS.CREATOR.savedPosts).toBeNull();
  });
});
