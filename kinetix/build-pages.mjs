import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "dist");
const maxAssetBytes = 24 * 1024 * 1024;
const excludedDirectories = new Set([
  ".git",
  ".wrangler",
  "backend",
  "dist",
  "functions",
  "node_modules",
]);
const excludedFiles = new Set([
  ".assetsignore",
  ".dockerignore",
  "Dockerfile",
  "build-pages.mjs",
  "schema.sql",
  "wrangler.toml",
]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

async function copySiteFiles(source, relativeDirectory = "") {
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const sourcePath = path.join(source, entry.name);

    if (!relativeDirectory && excludedDirectories.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copySiteFiles(sourcePath, relativePath);
      continue;
    }

    if (!entry.isFile() || (!relativeDirectory && excludedFiles.has(entry.name))) {
      continue;
    }

    const file = await stat(sourcePath);
    if (file.size >= maxAssetBytes) {
      console.warn(
        `Skipping Pages asset above 24 MiB: ${relativePath} (${(file.size / 1024 / 1024).toFixed(1)} MiB)`,
      );
      continue;
    }

    const destination = path.join(output, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(sourcePath, destination);
  }
}

await copySiteFiles(root);
