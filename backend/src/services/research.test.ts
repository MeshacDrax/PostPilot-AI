import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    researchConnection: { findUnique: vi.fn() },
  },
}));

vi.mock("../db", () => ({ prisma }));

import { encryptAiApiKey } from "./aiCredentials";
import { buildResearchQuery, researchContent } from "./research";

const sourceText = [
  "Recent independent research describes how organizations are adapting their communications to changing audience expectations.",
  "The report compares several approaches and notes that clear, useful information can help readers understand relevant choices.",
  "It recommends checking the original methodology and context before applying findings to a particular business or community.",
  "The authors also emphasize that useful comparisons should distinguish observed evidence from assumptions and avoid treating broad patterns as a promise of individual results.",
  "Readers should look for publication dates, sample sizes, and the population included in the analysis. Comparing independent reports can reveal where findings agree and where additional context is needed.",
].join(" ");

beforeEach(() => {
  process.env.AI_CREDENTIALS_SECRET = "1".repeat(64);
  prisma.researchConnection.findUnique.mockResolvedValue({
    encryptedApiKey: encryptAiApiKey("test-tavily-key"),
  });
});

afterEach(() => {
  delete process.env.AI_CREDENTIALS_SECRET;
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("deep content research", () => {
  it("queries only the public topic, industry, and goal from a brief", () => {
    const query = buildResearchQuery({
      description: "New seasonal coffee menu",
      campaignGoal: "Awareness",
      audience: "private audience detail",
      price: "$9000",
      contactInformation: "private@example.test",
      brand: { industry: "Coffee shop", website: "private.example", brandVoice: "private voice notes" },
    });

    expect(query).toContain("New seasonal coffee menu");
    expect(query).toContain("Coffee shop");
    expect(query).toContain("Awareness");
    expect(query).not.toContain("private audience detail");
    expect(query).not.toContain("$9000");
    expect(query).not.toContain("private@example.test");
    expect(query).not.toContain("private.example");
    expect(query).not.toContain("private voice notes");
  });

  it("uses Tavily advanced search and returns a separate, sanitized source report", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answer: "A current research overview.",
      results: [
        {
          title: "Current research overview",
          url: "https://research.example/article",
          content: sourceText,
          published_date: "2026-09-20",
        },
        {
          title: "Invalid protocol",
          url: "javascript:alert(1)",
          content: sourceText,
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const report = await researchContent({
      description: "Current coffee consumer trends",
      campaignGoal: "Awareness",
      audience: "private audience detail",
    }, "user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      api_key: "test-tavily-key",
      search_depth: "advanced",
      max_results: 8,
      chunks_per_source: 3,
      include_answer: "advanced",
    });
    expect(requestBody.query).not.toContain("private audience detail");
    expect(report).toMatchObject({
      summary: "A current research overview.",
      searchDepth: "advanced",
      sources: [{ domain: "research.example", publishedDate: "2026-09-20" }],
    });
    expect(report.sources).toHaveLength(1);
  });

  it("requires a configured Tavily key before searching", async () => {
    prisma.researchConnection.findUnique.mockResolvedValue(null);

    await expect(researchContent({ description: "Coffee trends" }, "user-1"))
      .rejects.toMatchObject({ status: 503 });
  });
});
