import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

function parseRequiredDbgeneratedFields(schemaSource) {
  const models = {};
  let currentModel = null;
  for (const line of schemaSource.split("\n")) {
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      currentModel = modelMatch[1];
      models[currentModel] = [];
      continue;
    }
    if (currentModel && /^\}/.test(line)) {
      currentModel = null;
      continue;
    }
    if (currentModel && line.includes("@default(dbgenerated(")) {
      const fieldMatch = /^\s*(\w+)\s+(\w+)(\?)?/.exec(line);
      if (fieldMatch && !fieldMatch[3]) {
        models[currentModel].push(fieldMatch[1]);
      }
    }
  }
  return models;
}

function extractBlockAfterKey(text, keyRegex) {
  const match = keyRegex.exec(text);
  if (!match) return text;
  let i = match.index + match[0].length;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== "{" && text[i] !== "[") {
    const identMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)/.exec(text.slice(i));
    return identMatch ? `__IDENT__:${identMatch[1]}` : text.slice(i);
  }
  const open = text[i];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  const start = i;
  for (; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

// Databases created before the `dbgenerated` TEXT expression defaults were
// added have no column default on `TEXT NOT NULL` columns. Prisma omits a
// field the caller does not supply, causing MySQL error 1364 / P2011 ("Null
// constraint violation"). Every `.create`, `.createMany`, and `.upsert`
// (`create:`) across all 48 models with `dbgenerated` `TEXT NOT NULL` columns
// must explicitly supply those fields.
test("every Prisma insert across src/** supplies all dbgenerated TEXT NOT NULL columns", () => {
  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const models = parseRequiredDbgeneratedFields(schema);
  const modelEntries = Object.entries(models).filter(([, fields]) => fields.length > 0);
  assert.equal(modelEntries.length, 48, "expected 48 models with dbgenerated NOT NULL columns");

  const missing = [];

  for (const file of sourceFiles(path.join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const [model, fields] of modelEntries) {
      const camel = model[0].toLowerCase() + model.slice(1);
      for (const method of ["create", "createMany", "upsert"]) {
        const needle = `.${camel}.${method}(`;
        let idx = source.indexOf(needle);
        while (idx !== -1) {
          let depth = 0;
          let i = idx + needle.length - 1;
          for (; i < source.length; i++) {
            if (source[i] === "(") depth++;
            else if (source[i] === ")") {
              depth--;
              if (depth === 0) break;
            }
          }
          const callText = source.slice(idx, i + 1);
          let checkBlock =
            method === "upsert"
              ? extractBlockAfterKey(callText, /\bcreate\s*:/)
              : extractBlockAfterKey(callText, /\bdata\s*:/);

          if (checkBlock.startsWith("__IDENT__:")) {
            const ident = checkBlock.slice("__IDENT__:".length);
            const declIdx = source.lastIndexOf(`const ${ident}`, idx);
            checkBlock = declIdx === -1 ? "" : source.slice(declIdx, idx);
          }

          const lineNo = source.slice(0, idx).split("\n").length;
          for (const field of fields) {
            if (!new RegExp(`\\b${field}\\s*:|\\b${field}\\s*,|\\b${field}\\s*\\}`).test(checkBlock)) {
              missing.push(`${path.relative(root, file)}:${lineNo} — ${camel}.${method} without ${field}`);
            }
          }

          idx = source.indexOf(needle, idx + needle.length);
        }
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `writers still omitting a required TEXT column:\n${missing.join("\n")}`,
  );
});
