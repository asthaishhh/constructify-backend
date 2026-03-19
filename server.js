
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
// We'll use a lightweight custom sanitizer to avoid mutating getter-only req properties

// ✅ Routes (your current folder structure)
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.route.js";
import employeeRoutes from "./routes/employee.route.js";
import invoiceRoutes from "./routes/invoice.route.js";
import materialRoutes from "./routes/material.routes.js";
import orderRoutes from "./routes/order.route.js";
import emailRoutes from "./routes/email.js";
import dashboardRoutes from "./routes/dashboard.route.js";


// Ensure .env is loaded from the backend directory regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

if (!process.env.MONGODB_URI) {
  console.warn("MONGODB_URI not found in .env (backend). Using process.env value if set externally.");
}

const app = express();

// Basic logging
app.use(morgan("dev"));

// Security middlewares
app.use(helmet());
// CORS: allow origin from env or allow any in development
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// Request sanitization controls via environment variables:
// SANITIZE_REQUESTS=true|false (default: true)
// SANITIZER_SILENT=true|false (default: false) — when true, suppress warnings
const SANITIZE_REQUESTS = (process.env.SANITIZE_REQUESTS ?? "true") === "true";
const SANITIZER_SILENT = (process.env.SANITIZER_SILENT ?? "false") === "true";

// Prevent NoSQL injection attacks by sanitizing `req.body` and `req.params` only.
// Avoid touching `req.query` because some environments expose it as a getter-only property.
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clone = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    // replace keys that contain '$' or '.' which are Mongo operators/paths
    const safeKey = k.replace(/\$|\./g, "_");
    if (v && typeof v === "object") clone[safeKey] = sanitizeObject(v);
    else clone[safeKey] = v;
  }
  return clone;
};

if (SANITIZE_REQUESTS) {
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") return next();
    try {
      if (req.body) req.body = sanitizeObject(req.body);
      if (req.params) req.params = sanitizeObject(req.params);
    } catch (err) {
      if (!SANITIZER_SILENT) console.warn("Request sanitization failed:", err && err.message);
    }
    return next();
  });
} else {
  if (!SANITIZER_SILENT) console.log("Request sanitization disabled by SANITIZE_REQUESTS=false");
}
// Rate limiter - global basic limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(express.json({ limit: "10mb" }));

// ✅ Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Root + health
app.get("/", (req, res) => res.send("API is running"));
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "backend", timestamp: new Date().toISOString() });
});
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Server start
const PORT = process.env.PORT || 5000;
// Centralized error handler (simple)
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));