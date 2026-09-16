#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_ROOTS = [path.join(ROOT, "src"), path.resolve(ROOT, "..", "backend", "app")];
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".scss", ".vue", ".py", ".php", ".sql", ".md"]);
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".vite", ".cache", "__pycache__"]);
const MOJIBAKE_PATTERNS = [
  /Ã¢/u,
  /Ã‚/u,
  /Ãƒ/u,
  /Ã°Å¸/u,
  /Ã¯Â¿Â½/u,
  /ï¿½/u,
  /�/u,
  /(?:&#x[0-9a-f]+;|&#\d+;|&nbsp;)/iu,
];
const PLACEHOLDER_RE = /\{\{?\s*([\w.-]+)\s*\}?\}|%[sd]/g;
const RAW_KEY_RE = /\bt\(\s*["']([^"']+)["']/g;
const STRING_KEY_RE = /["']([^"']+)["']\s*:/g;

const allowlistPath = path.join(SCRIPT_DIR, "i18n-allowlist.json");
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const errors = [];
const warnings = [];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) files.push(...walk(path.join(dir, entry.name)));
    if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(path.join(dir, entry.name));
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function report(collection, file, line, column, message, snippet) {
  collection.push(`${rel(file)}:${line}:${column} ${message}${snippet ? ` :: ${snippet.trim().slice(0, 180)}` : ""}`);
}

function findTextIssues(file, text) {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file)) return;
  const lines = text.split(/\r?\n/u);
  lines.forEach((lineText, index) => {
    for (const pattern of MOJIBAKE_PATTERNS) {
      const match = pattern.exec(lineText);
      if (match) {
        report(errors, file, index + 1, match.index + 1, `encoding/mojibake matched ${pattern}`, lineText);
        break;
      }
    }
    const zeroWidth = [...lineText].findIndex((char) => /[\u200B\u200C\u200D\uFEFF]/u.test(char));
    const isFileBom = index === 0 && zeroWidth === 0 && lineText.codePointAt(0) === 0xfeff;
    if (zeroWidth >= 0 && !isFileBom) {
      report(errors, file, index + 1, zeroWidth + 1, "unexpected zero-width character", lineText);
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(lineText)) {
      report(errors, file, index + 1, 1, "unexpected control character", lineText);
    }
  });
}

function section(text, language) {
  const start = text.indexOf(`${language}: {`);
  if (start < 0) return "";
  const next = language === "id" ? text.indexOf("en: {", start + 1) : text.length;
  return text.slice(start, next < 0 ? text.length : next);
}

function parseCatalog(text, language) {
  const values = new Map();
  const duplicates = new Set();
  const body = section(text, language);
  for (const match of body.matchAll(STRING_KEY_RE)) {
    const key = match[1];
    if (values.has(key)) duplicates.add(key);
    values.set(key, "");
  }
  // Values are parsed separately so multiline catalog entries remain supported.
  const valueRe = /["']([^"']+)["']\s*:\s*(?:\r?\n\s*)?(["'])(.*?)(?<!\\)\2/gs;
  for (const match of body.matchAll(valueRe)) {
    const key = match[1];
    if (!values.has(key)) continue;
    const raw = match[3].replaceAll(`\\${match[2]}`, match[2]);
    values.set(key, raw.replaceAll("\\n", "\n").replaceAll("\\u00a0", "\u00a0"));
  }
  return { values, duplicates };
}

function placeholders(value) {
  return [...value.matchAll(PLACEHOLDER_RE)].map((match) => match[0]).sort();
}

function compareCatalog(file) {
  const text = fs.readFileSync(file, "utf8");
  const id = parseCatalog(text, "id");
  const en = parseCatalog(text, "en");
  if (!id.values.size || !en.values.size) return null;
  for (const key of id.values.keys()) if (!en.values.has(key)) errors.push(`${rel(file)} missing EN key: ${key}`);
  for (const key of en.values.keys()) if (!id.values.has(key)) errors.push(`${rel(file)} missing ID key: ${key}`);
  for (const key of id.duplicates) errors.push(`${rel(file)} duplicate ID key: ${key}`);
  for (const key of en.duplicates) errors.push(`${rel(file)} duplicate EN key: ${key}`);
  for (const [key, value] of id.values) {
    if (!value.trim()) errors.push(`${rel(file)} empty ID value: ${key}`);
    if (value.trim() === key) warnings.push(`${rel(file)} ID value equals key: ${key}`);
    if (en.values.has(key) && JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(en.values.get(key)))) {
      errors.push(`${rel(file)} placeholder mismatch: ${key} ID=${placeholders(value).join(",")} EN=${placeholders(en.values.get(key)).join(",")}`);
    }
  }
  for (const [key, value] of en.values) {
    if (!value.trim()) errors.push(`${rel(file)} empty EN value: ${key}`);
    if (value.trim() === key) warnings.push(`${rel(file)} EN value equals key: ${key}`);
  }
  return { id: id.values, en: en.values };
}

function collectCatalogKeys(files) {
  const keys = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const parsed = compareCatalog(file);
    if (parsed) for (const key of [...parsed.id.keys(), ...parsed.en.keys()]) keys.add(key);
    if (file.endsWith("legacyTranslations.ts")) {
      for (const match of text.matchAll(/^[ \t]*["']([^"']+)["'],?$/gmu)) keys.add(match[1]);
    }
  }
  return keys;
}

function auditRenderedKeys(files, catalogKeys) {
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(RAW_KEY_RE)) {
      if (!catalogKeys.has(match[1])) {
        const before = text.slice(0, match.index);
        const line = before.split(/\r?\n/u).length;
        report(errors, file, line, match.index - before.lastIndexOf("\n"), `missing translation key ${match[1]}`, match[0]);
      }
    }
    if (file.endsWith(".tsx")) {
      const hardcoded = />\s*([A-Za-zÀ-ÿ][^<{>\r\n]*?)\s*</gu;
      const attributes = /(?:placeholder|aria-label|title|alt)\s*=\s*(["'])(.*?)\1/gu;
      for (const match of [...text.matchAll(hardcoded), ...text.matchAll(attributes)]) {
        const value = (match[2] ?? match[1]).trim();
        if (!value || allowlist.hardcodedValues.includes(value) || allowlist.technicalTerms.includes(value) || /^[A-Z0-9_.:/-]+$/u.test(value)) continue;
        const line = text.slice(0, match.index).split(/\r?\n/u).length;
        warnings.push(`${rel(file)}:${line} candidate hardcoded UI text: ${value.slice(0, 100)}`);
      }
    }
  }
}

function routeRegistry() {
  const file = path.join(ROOT, "src/routes/AppRoutes.tsx");
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  return [...text.matchAll(/\bpath\s*[:=]\s*["']([^"']+)["']/gu)].map((match) => match[1]);
}

const files = SOURCE_ROOTS.flatMap((root) => fs.existsSync(root) ? walk(root) : []);
for (const file of files) findTextIssues(file, fs.readFileSync(file, "utf8"));
const catalogFiles = [path.join(ROOT, "src/i18n/translations.ts"), path.join(ROOT, "src/i18n/approvedTranslations.ts")].filter(fs.existsSync);
const catalogKeys = collectCatalogKeys(catalogFiles.concat(path.join(ROOT, "src/i18n/legacyTranslations.ts")));
auditRenderedKeys(files, catalogKeys);
const routes = [...new Set(routeRegistry())].sort();

console.log(`i18n audit: ${files.length} source files scanned, ${catalogKeys.size} catalog keys indexed`);
console.log(`route registry: ${routes.length} routes indexed`);
console.log(`fatal issues: ${errors.length}`);
for (const issue of errors) console.log(`ERROR ${issue}`);
console.log(`warnings: ${warnings.length}`);
for (const warning of warnings.slice(0, 80)) console.log(`WARN ${warning}`);
if (warnings.length > 80) console.log(`WARN ... ${warnings.length - 80} additional hardcoded candidates`);
process.exitCode = errors.length ? 1 : 0;
