#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_ROOTS = [path.join(ROOT, "src"), path.resolve(ROOT, "..", "backend", "app")];
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".scss", ".vue", ".py", ".php", ".sql", ".md"]);
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".vite", ".cache", "__pycache__"]);
const MOJIBAKE_PATTERNS = [
  /Â/u,
  /Ã¢/u,
  /Ã‚/u,
  /Ãƒ/u,
  /Ã°Å¸/u,
  /Ã¯Â¿Â½/u,
  /ï¿½/u,
  /�/u,
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

function isUserFacingText(value) {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < 3 || !/[A-Za-zÀ-ÿ]/u.test(normalized)) return false;
  if (/^&(?:[A-Za-z]+|#\d+);$/u.test(normalized)) return false;
  if (allowlist.hardcodedValues.includes(normalized) || allowlist.technicalTerms.includes(normalized)) return false;
  if (/^[A-Z0-9_.:/-]+$/u.test(normalized)) return false;
  if (/^(?:\d+|(?:km²|km|ha|m|cm|mm|Mg C\/ha|Mg\/ha|tCO₂e|tCO2e|UTC|%)\s*)$/iu.test(normalized)) return false;
  if (/^https?:\/\//iu.test(normalized)) return false;
  return true;
}

function isInsideCode(node, sourceFile) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
      const tagName = ts.isJsxElement(current) ? current.openingElement.tagName : current.tagName;
      const tag = tagName.getText(sourceFile).toLowerCase();
      if (tag === "code" || tag === "pre") return true;
    }
  }
  return false;
}

function auditRenderedKeys(files, catalogKeys) {
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file);
    if (!isTest) {
      for (const match of text.matchAll(RAW_KEY_RE)) {
        if (!catalogKeys.has(match[1])) {
          const before = text.slice(0, match.index);
          const line = before.split(/\r?\n/u).length;
          report(errors, file, line, match.index - before.lastIndexOf("\n"), `missing translation key ${match[1]}`, match[0]);
        }
      }
    }
    if (!file.endsWith(".tsx") || isTest) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node) && !isInsideCode(node, sourceFile)) {
        const value = node.text.trim().replace(/\s+/gu, " ");
        if (isUserFacingText(value)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          report(warnings, file, pos.line + 1, pos.character + 1, "candidate hardcoded UI text", value);
        }
      }
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const attribute = node.name.getText(sourceFile);
        if (["placeholder", "aria-label", "title", "alt"].includes(attribute) && isUserFacingText(node.initializer.text)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          report(warnings, file, pos.line + 1, pos.character + 1, `candidate hardcoded ${attribute}`, node.initializer.text);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
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
const catalogFiles = [
  path.join(ROOT, "src/i18n/translations.ts"),
  path.join(ROOT, "src/i18n/approvedTranslations.ts"),
  path.join(ROOT, "src/features/dmrv/i18n.ts"),
].filter(fs.existsSync);
const catalogKeys = collectCatalogKeys(catalogFiles.concat(path.join(ROOT, "src/i18n/legacyTranslations.ts")));
auditRenderedKeys(files, catalogKeys);
const routes = [...new Set(routeRegistry())].sort();

console.log(`i18n audit: ${files.length} source files scanned, ${catalogKeys.size} catalog keys indexed`);
console.log(`route registry: ${routes.length} routes indexed`);
console.log(`fatal issues: ${errors.length}`);
for (const issue of errors) console.log(`ERROR ${issue}`);
console.log(`warnings: ${warnings.length}`);
const warningLimit = process.env.SAVEGEO_I18N_AUDIT_ALL === "1" ? warnings.length : 80;
for (const warning of warnings.slice(0, warningLimit)) console.log(`WARN ${warning}`);
if (warnings.length > warningLimit) console.log(`WARN ... ${warnings.length - warningLimit} additional hardcoded candidates`);process.exitCode = errors.length ? 1 : 0;
