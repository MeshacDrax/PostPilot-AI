import "./config/loadEnv";
import app from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT ?? 4000);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

const server = app.listen(port, () => {
  console.log(`PostPilot API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
