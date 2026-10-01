import { prisma } from "../db";
import { ApiError } from "../utils/http";
import { decryptAiApiKey } from "./aiCredentials";

export type ResearchSource = {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  publishedDate: string | null;
};

export type ResearchReport = {
  summary: string;
  sources: ResearchSource[];
  searchDepth: "advanced";
  searchedAt: string;
};

type ResearchBrief = {
  description: string;
  audience?: string;
  price?: string;
  website?: string;
  contactInformation?: string;
  campaignGoal?: string;
  brand?: { industry?: string | null; website?: string | null; brandVoice?: string | null } | null;
};

function countWords(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

export function buildResearchQuery(brief: ResearchBrief) {
  return [
    brief.description.trim().slice(0, 300),
    brief.brand?.industry?.trim(),
    brief.campaignGoal ? `${brief.campaignGoal} context and current evidence` : "current evidence and useful context",
  ].filter(Boolean).join(" ");
}

async function getResearchApiKey(userId: string) {
  const connection = await prisma.researchConnection.findUnique({
    where: { userId },
    select: { encryptedApiKey: true },
  });
  if (!connection) {
    throw new ApiError(503, "Connect a Tavily Search API key in Settings → Deep research before enabling research.");
  }
  return decryptAiApiKey(connection.encryptedApiKey);
}

async function searchTavily(query: string, apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 8,
        chunks_per_source: 3,
        include_answer: "advanced",
        include_published_date: true,
        topic: "general",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(504, "Deep research timed out. Try again in a moment.");
    }
    throw new ApiError(502, "Could not reach Tavily Search. Check the backend network connection.");
  }

  if (!response.ok) {
    console.error("Tavily Search returned status", response.status);
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, "Tavily rejected the saved API key. Update it in Settings → Deep research.");
    }
    if (response.status === 429) {
      throw new ApiError(503, "Tavily's request limit or account credits were reached. Check your Tavily account.");
    }
    throw new ApiError(502, "Tavily could not complete the research request. Check the brief and try again.");
  }

  let payload: {
    answer?: unknown;
    results?: Array<{
      title?: unknown;
      url?: unknown;
      content?: unknown;
      published_date?: unknown;
    }>;
  };
  try {
    payload = await response.json() as typeof payload;
  } catch {
    throw new ApiError(502, "Tavily returned an invalid research response. Try again.");
  }

  const sources = (payload.results ?? []).flatMap((result): ResearchSource[] => {
    if (typeof result.title !== "string" || typeof result.url !== "string" || typeof result.content !== "string") return [];
    try {
      const url = new URL(result.url);
      if (!["https:", "http:"].includes(url.protocol)) return [];
      return [{
        title: result.title.trim().slice(0, 240),
        url: url.toString(),
        domain: url.hostname,
        excerpt: result.content.trim().slice(0, 1800),
        publishedDate: typeof result.published_date === "string" ? result.published_date : null,
      }];
    } catch {
      return [];
    }
  }).slice(0, 8);

  if (!sources.length) {
    throw new ApiError(502, "Deep research found no usable sources for this brief. Refine the topic and try again.");
  }

  return {
    summary: typeof payload.answer === "string" ? payload.answer.trim().slice(0, 3000) : "",
    sources,
    searchDepth: "advanced" as const,
    searchedAt: new Date().toISOString(),
  };
}

export async function researchContent(brief: ResearchBrief, userId: string): Promise<ResearchReport> {
  const apiKey = await getResearchApiKey(userId);
  const report = await searchTavily(buildResearchQuery(brief), apiKey);
  const groundedWords = [
    report.summary,
    ...report.sources.map((source) => `${source.title}\n${source.excerpt}`),
  ].join("\n");
  if (countWords(groundedWords) < 80) {
    throw new ApiError(502, "Tavily returned too little source material for deep research. Refine the topic and try again.");
  }
  return report;
}

export async function testResearchConnection(userId: string) {
  const apiKey = await getResearchApiKey(userId);
  const result = await searchTavily("current social media content marketing research", apiKey);
  return {
    sourceCount: result.sources.length,
    searchDepth: result.searchDepth,
    latencyValidated: true,
  };
}
