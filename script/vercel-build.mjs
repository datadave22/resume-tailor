#!/usr/bin/env node
/**
 * Vercel Build Output API v3 builder
 *
 * Produces .vercel/output/ with:
 *   static/                      – Vite client build
 *   functions/api/index.func/    – esbuild-bundled Express serverless function
 *   config.json                  – routing rules
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const OUT = ".vercel/output";
const FUNC_DIR = `${OUT}/functions/api/index.func`;

// Clean previous output
rmSync(OUT, { recursive: true, force: true });
rmSync("dist", { recursive: true, force: true });

// 1. Build client with Vite
console.log("▸ Building client (Vite)…");
execSync("npx vite build", { stdio: "inherit" });

// 2. Copy static assets
console.log("▸ Copying static files…");
mkdirSync(`${OUT}/static`, { recursive: true });
cpSync("dist/public", `${OUT}/static`, { recursive: true });

// 3. Bundle serverless function (all deps included, no externals)
mkdirSync(FUNC_DIR, { recursive: true });
console.log("▸ Bundling serverless function (esbuild)…");
execSync(
  [
    "npx esbuild server/vercel-entry.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    `--outfile=${FUNC_DIR}/index.js`,
    "--minify",
  ].join(" "),
  { stdio: "inherit" },
);

// 4. Function runtime config
writeFileSync(
  `${FUNC_DIR}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.js",
      launcherType: "Nodejs",
      maxDuration: 60,
    },
    null,
    2,
  ),
);

// 5. Build Output routing config
writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/api/(.*)", dest: "/api/index" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("✓ Vercel Build Output ready at .vercel/output/");
