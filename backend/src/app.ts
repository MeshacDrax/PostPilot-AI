import "./config/loadEnv";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { healthController } from "./controllers/health";
import { requireAuth } from "./middleware/auth";
import aiRoutes from "./routes/ai";
import authRoutes from "./routes/auth";
import contentRoutes from "./routes/content";
import workspaceRoutes from "./routes/workspace";
import { errorHandler } from "./utils/http";

const app = express();
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
  }),
);
app.get("/api/health", healthController);
app.use("/api/auth", authRoutes);
app.use("/api/ai", requireAuth, aiRoutes);
app.use("/api", requireAuth, workspaceRoutes);
app.use("/api/content", requireAuth, contentRoutes);
app.use((_req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));
app.use(errorHandler);

export default app;
