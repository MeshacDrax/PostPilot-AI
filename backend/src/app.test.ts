import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { encryptAiApiKey } from "./services/aiCredentials";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    brand: { findMany: vi.fn() },
    content: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    favorite: { upsert: vi.fn(), deleteMany: vi.fn() },
    aIConnection: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    researchConnection: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma }));

import app from "./app";

const secret = "test-secret-for-postpilot-authentication-0123456789";
const sessionCookie = () => `postpilot_session=${jwt.sign({ sub: "user-1" }, secret)}`;

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  process.env.FRONTEND_URL = "http://localhost:5173";
  delete process.env.AI_API_KEY;
  delete process.env.AI_CREDENTIALS_SECRET;
  vi.resetAllMocks();
  prisma.aIConnection.findUnique.mockResolvedValue(null);
  prisma.aIConnection.deleteMany.mockResolvedValue({ count: 0 });
  prisma.researchConnection.findUnique.mockResolvedValue(null);
  prisma.researchConnection.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  delete process.env.AI_API_KEY;
  delete process.env.AI_CREDENTIALS_SECRET;
});

describe("authentication API", () => {
  it("registers a user with a hashed password and creates a session cookie", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "user-1", name: "Alex Smith", email: "alex@example.com" });
    const response = await request(app).post("/api/auth/register").send({
      name: "Alex Smith",
      email: "Alex@example.com",
      password: "safe-password-123",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("alex@example.com");
    expect(response.headers["set-cookie"][0]).toContain("postpilot_session=");
    const submittedHash = prisma.user.create.mock.calls[0][0].data.passwordHash;
    expect(submittedHash).not.toBe("safe-password-123");
    expect(await bcrypt.compare("safe-password-123", submittedHash)).toBe(true);
  });

  it("authenticates a user with a valid password", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alex Smith",
      email: "alex@example.com",
      passwordHash: await bcrypt.hash("safe-password-123", 4),
    });
    const response = await request(app).post("/api/auth/login").send({
      email: "alex@example.com",
      password: "safe-password-123",
    });

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"][0]).toContain("postpilot_session=");
  });

  it("rejects unauthenticated workspace requests", async () => {
    const response = await request(app).get("/api/brands");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: "Authentication required" });
    expect(prisma.brand.findMany).not.toHaveBeenCalled();
  });

  it("lists brand profiles only after authenticating the user", async () => {
    prisma.brand.findMany.mockResolvedValue([{ id: "brand-1", userId: "user-1", name: "Studio North" }]);
    const response = await request(app).get("/api/brands").set("Cookie", sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body.brands).toHaveLength(1);
    expect(prisma.brand.findMany.mock.calls[0][0].where.userId).toBe("user-1");
  });

  it("reports AI configuration without exposing provider credentials", async () => {
    const response = await request(app).get("/api/ai/status").set("Cookie", sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body.ai).toMatchObject({
      configured: false,
      provider: "api.openai.com",
      model: "gpt-4o-mini",
    });
    expect(JSON.stringify(response.body)).not.toContain("apiKey");
  });

  it("reports an account connection without exposing its encrypted or decrypted key", async () => {
    process.env.AI_CREDENTIALS_SECRET = "d".repeat(64);
    prisma.aIConnection.findUnique
      .mockResolvedValueOnce({
        provider: "OPENAI_COMPATIBLE",
        baseUrl: "https://provider.example/v1",
        model: "custom-model",
        encryptedApiKey: encryptAiApiKey("account-test-key"),
      })
      .mockResolvedValueOnce({
        provider: "OPENAI_COMPATIBLE",
        baseUrl: "https://provider.example/v1",
        model: "custom-model",
      });
    const response = await request(app).get("/api/ai/status").set("Cookie", sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body.ai).toMatchObject({
      configured: true,
      provider: "provider.example",
      model: "custom-model",
      source: "account",
      hasAccountConnection: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("account-test-key");
  });

  it("explains that provider checks require a server-side key", async () => {
    const response = await request(app).post("/api/ai/test").set("Cookie", sessionCookie());

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("No AI provider key is configured");
  });

  it("requires an encryption secret before accepting account API keys", async () => {
    delete process.env.AI_CREDENTIALS_SECRET;
    const response = await request(app)
      .put("/api/ai/connection")
      .set("Cookie", sessionCookie())
      .send({ provider: "OPENAI", apiKey: "server-test-key", model: "gpt-4o-mini" });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("AI_CREDENTIALS_SECRET");
    expect(prisma.aIConnection.upsert).not.toHaveBeenCalled();
  });

  it("stores account provider keys encrypted and never returns them", async () => {
    process.env.AI_CREDENTIALS_SECRET = "a".repeat(64);
    prisma.aIConnection.findUnique.mockResolvedValue(null);
    prisma.aIConnection.upsert.mockResolvedValue({
      provider: "OPENAI",
      baseUrl: null,
      model: "gpt-4o-mini",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const response = await request(app)
      .put("/api/ai/connection")
      .set("Cookie", sessionCookie())
      .send({ provider: "OPENAI", apiKey: "private-test-key", model: "gpt-4o-mini" });

    expect(response.status).toBe(200);
    expect(response.body.connection).toMatchObject({
      provider: "OPENAI",
      model: "gpt-4o-mini",
      hasApiKey: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("private-test-key");
    const storedKey = prisma.aIConnection.upsert.mock.calls[0][0].create.encryptedApiKey;
    expect(storedKey).not.toContain("private-test-key");
    expect(storedKey).toMatch(/^v1:/);
  });

  it("retains an existing encrypted key when updating provider settings without a new key", async () => {
    process.env.AI_CREDENTIALS_SECRET = "b".repeat(64);
    prisma.aIConnection.findUnique.mockResolvedValue({
      encryptedApiKey: encryptAiApiKey("existing-test-key"),
    });
    prisma.aIConnection.upsert.mockResolvedValue({
      provider: "OPENAI_COMPATIBLE",
      baseUrl: "https://provider.example/v1",
      model: "custom-model",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const response = await request(app)
      .put("/api/ai/connection")
      .set("Cookie", sessionCookie())
      .send({
        provider: "OPENAI_COMPATIBLE",
        baseUrl: "https://provider.example/v1",
        model: "custom-model",
      });

    expect(response.status).toBe(200);
    expect(prisma.aIConnection.upsert.mock.calls[0][0].update).not.toHaveProperty("encryptedApiKey");
    expect(JSON.stringify(response.body)).not.toContain("existing-test-key");
  });

  it("rejects compatible provider URLs with embedded credentials", async () => {
    process.env.AI_CREDENTIALS_SECRET = "c".repeat(64);
    const response = await request(app)
      .put("/api/ai/connection")
      .set("Cookie", sessionCookie())
      .send({
        provider: "OPENAI_COMPATIBLE",
        apiKey: "private-test-key",
        model: "custom-model",
        baseUrl: "https://user:password@provider.example/v1",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("without embedded credentials");
    expect(prisma.aIConnection.upsert).not.toHaveBeenCalled();
  });

  it("stores Tavily keys encrypted and returns only connection status", async () => {
    process.env.AI_CREDENTIALS_SECRET = "e".repeat(64);
    prisma.researchConnection.findUnique.mockResolvedValue(null);
    prisma.researchConnection.upsert.mockResolvedValue({});
    const response = await request(app)
      .put("/api/ai/research-connection")
      .set("Cookie", sessionCookie())
      .send({ apiKey: "private-tavily-test-key" });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("private-tavily-test-key");
    const storedKey = prisma.researchConnection.upsert.mock.calls[0][0].create.encryptedApiKey;
    expect(storedKey).toMatch(/^v1:/);
    expect(storedKey).not.toContain("private-tavily-test-key");
  });

  it("retains the saved Tavily key when the replacement field is omitted", async () => {
    process.env.AI_CREDENTIALS_SECRET = "f".repeat(64);
    prisma.researchConnection.findUnique.mockResolvedValue({
      encryptedApiKey: encryptAiApiKey("existing-tavily-test-key"),
    });
    prisma.researchConnection.upsert.mockResolvedValue({});
    const response = await request(app)
      .put("/api/ai/research-connection")
      .set("Cookie", sessionCookie())
      .send({});

    expect(response.status).toBe(200);
    expect(prisma.researchConnection.upsert.mock.calls[0][0].update).toEqual({});
    expect(JSON.stringify(response.body)).not.toContain("existing-tavily-test-key");
  });

  it("rejects invalid registration input", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
    });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe("protected content API", () => {
  it("retrieves only the authenticated user's content with pagination", async () => {
    prisma.content.findMany.mockResolvedValue([]);
    prisma.content.count.mockResolvedValue(0);
    const response = await request(app).get("/api/content?page=2&pageSize=5").set("Cookie", sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      items: [],
      pagination: { page: 2, pageSize: 5, total: 0 },
    });
    expect(prisma.content.findMany.mock.calls[0][0].where.userId).toBe("user-1");
  });

  it("validates generation requests before reserving AI usage", async () => {
    const response = await request(app).post("/api/content/generate").set("Cookie", sessionCookie()).send({});
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks saving content after the Free saved-post limit", async () => {
    prisma.content.findFirst.mockResolvedValue({ id: "post-1", userId: "user-1", isSaved: false });
    prisma.subscription.findUnique.mockResolvedValue({ plan: "FREE" });
    prisma.content.count.mockResolvedValue(10);
    const response = await request(app).post("/api/content/post-1/save").set("Cookie", sessionCookie());

    expect(response.status).toBe(402);
    expect(response.body.message).toContain("Saved post limit reached");
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it("saves content within the plan limit", async () => {
    prisma.content.findFirst.mockResolvedValue({ id: "post-1", userId: "user-1", isSaved: false });
    prisma.subscription.findUnique.mockResolvedValue({ plan: "FREE" });
    prisma.content.count.mockResolvedValue(3);
    prisma.content.update.mockResolvedValue({ id: "post-1", isSaved: true });
    const response = await request(app).post("/api/content/post-1/save").set("Cookie", sessionCookie());

    expect(response.status).toBe(200);
    expect(response.body.content.isSaved).toBe(true);
  });
});
