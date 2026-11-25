#!/usr/bin/env node
// Regenerate the README comparison table from tools.json.
//
//   node render_table.mjs                    print the table
//   node render_table.mjs --write            rewrite the block between the markers
//   node render_table.mjs --check            exit 1 when README and data disagree
//   node render_table.mjs --ai-mode          only trackers that read Google AI Mode
//   node render_table.mjs --max-price 100    only entry prices at or under 100 (any currency)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const root = dirname(fileURLToPath(import.meta.url));
const readme = join(root, "README.md");
const tools = JSON.parse(readFileSync(join(root, "tools.json"), "utf8"));

const { values } = parseArgs({
  options: {
    write: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    "ai-mode": { type: "boolean", default: false },
    "max-price": { type: "string" },
  },
});

const money = (t) => {
  if (t.price === null) return t.billing;
  const n = Number.isInteger(t.price) ? String(t.price) : t.price.toFixed(2);
  return `${t.currency}${n.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}/mo${t.billing === "monthly" ? "" : `, ${t.billing}`}`;
};

export function table(list) {
  const head = ["Tool", "Best for", "Engines", "Collection", "Data access", "Entry price", "Trial"];
  const rows = list.map((t) => [`[${t.name}](${t.url})`, t.bestFor, t.engines, t.collection, t.access, money(t), t.trial]);
  return [head, head.map(() => "---"), ...rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
}

function splice(text, body) {
  const start = "<!-- TABLE:START -->";
  const end = "<!-- TABLE:END -->";
  const a = text.indexOf(start) + start.length;
  const b = text.indexOf(end);
  if (a < start.length || b < 0) throw new Error("table markers not found in README.md");
  return `${text.slice(0, a)}\n${body}\n${text.slice(b)}`;
}

let list = tools;
if (values["ai-mode"]) list = list.filter((t) => t.readsAiMode);
if (values["max-price"]) {
  const cap = Number(values["max-price"]);
  list = list.filter((t) => t.price !== null && t.price <= cap);
}

if (!values.write && !values.check) {
  console.log(table(list));
  process.exit(0);
}

const text = readFileSync(readme, "utf8");
const next = splice(text, table(tools));
if (values.check) {
  if (next !== text) {
    console.error("README table is stale, run: node render_table.mjs --write");
    process.exit(1);
  }
  console.log("README table matches tools.json");
} else {
  writeFileSync(readme, next, "utf8");
  console.log("README table updated");
}
