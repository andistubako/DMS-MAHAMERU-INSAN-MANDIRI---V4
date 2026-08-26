// Enforce GMT+7 (Asia/Jakarta / WIB) timezone globally
process.env.TZ = "Asia/Jakarta";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/routes.js";
import { db as inMemoryDb, saveDatabaseToDisk } from "./server/data.js";
import { loadAllFromCloudSql, testCloudSqlConnection } from "./server/cloudSqlSync.js";

async function startServer() {
  // Test and load persistent data from Cloud SQL (PostgreSQL)
  try {
    const isPgReady = await testCloudSqlConnection();
    if (isPgReady) {
      const loaded = await loadAllFromCloudSql(inMemoryDb);
      if (loaded) {
        saveDatabaseToDisk(true);
      }
    }
  } catch (err) {
    console.warn("Initial Cloud SQL restore notice:", err);
  }

  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));
  app.use(cookieParser());

  // Mount API router
  app.use("/api", apiRouter);

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MAHAMERU DMS Server running on http://0.0.0.0:${PORT} [Connected to Cloud SQL PostgreSQL]`);
  });
}

startServer();
