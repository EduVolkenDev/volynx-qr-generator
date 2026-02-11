import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { initDb } from "./db.js";
import setupRoutes from "./routes/setup.js";
import authRoutes from "./routes/auth.js";
import qrRoutes from "./routes/qr.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import operatorRoutes from "./routes/operator.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = process.env.DATA_DIR || path.join(projectRoot, "data");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "signatures"), { recursive: true });

initDb();

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false, // simplifica dev; ajuste CSP em produção
  }),
);
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// API Routes
app.use("/api/setup", setupRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/operator", operatorRoutes);

// --- Static + SPA fallback
app.use(express.static(publicDir, { maxAge: "1h" }));

// SPA: qualquer rota não-API carrega index
app.get(/^\/(?!api\b).*/, (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Volynx QR-Generator rodando em ${APP_BASE_URL}`);
});
