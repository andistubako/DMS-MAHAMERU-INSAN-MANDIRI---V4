// Enforce GMT+7 (Asia/Jakarta / WIB) timezone globally
process.env.TZ = "Asia/Jakarta";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/routes.js";
import { db as inMemoryDb, saveDatabaseToDisk } from "./server/data.js";
import { loadAllFromFirestore, syncToFirestore } from "./server/firestoreSync.js";
import { initializeCloudSqlTables, migrateAllToCloudSql } from "./server/cloudsqlSync.js";

async function startServer() {
  // Load and hydrate primary persistent data from Google Cloud Firestore
  try {
    const loaded = await loadAllFromFirestore(inMemoryDb);
    if (loaded) {
      saveDatabaseToDisk(true);
    }
  } catch (err) {
    console.warn("Initial Cloud Firestore restore notice:", err);
  }

  // Trigger Firestore synchronization in background
  try {
    syncToFirestore(true, true).catch((e) => {
      console.warn("Initial Firestore sync notice:", e?.message);
    });
  } catch {
    // ignore
  }

  // Trigger Cloud SQL (PostgreSQL) initialization and migration in background
  try {
    initializeCloudSqlTables()
      .then((ok) => {
        if (ok) {
          return migrateAllToCloudSql();
        }
      })
      .catch((e) => {
        console.warn("Initial Cloud SQL setup notice:", e?.message);
      });
  } catch {
    // ignore
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
    console.log(`MAHAMERU DMS Server running on http://0.0.0.0:${PORT} [Primary Database: Google Cloud Firestore]`);
  });
}

startServer();
