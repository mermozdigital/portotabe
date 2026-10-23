import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const publicDirectory = resolve(root, "public");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif", ".ico"]);

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

// Publish only the page, its styles/script, and public images.
for (const file of ["index.html", "styles.css", "script.js"]) {
  cpSync(resolve(root, file), resolve(output, file));
}

cpSync(publicDirectory, resolve(output, "public"), {
  recursive: true,
  filter: (path) => path === publicDirectory || !extname(path) || imageExtensions.has(extname(path).toLowerCase()),
});
