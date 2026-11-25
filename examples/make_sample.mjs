#!/usr/bin/env node
// Seeded generator for examples/answers.example.jsonl.
// Everything here is synthetic. The brands are fictional and the answers are templated.
// Planted pattern: Fernlight gains ground on the ai-mode engine in the second week.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261012);

const brands = [
  { name: "Fernlight", domain: "fernlight.example", base: 0.5 },
  { name: "Northwind Metrics", domain: "northwindmetrics.example", base: 0.7 },
  { name: "Quillstack", domain: "quillstack.example", base: 0.45 },
  { name: "Brightpost", domain: "brightpost.example", base: 0.35 },
  { name: "Orbit Ledger", domain: "orbitledger.example", base: 0.3 },
];

const prompts = [
  "best chatgpt visibility tracker for a small team",
  "best chatgpt rank tracker tools for agencies",
  "chatgpt tracker with an api",
  "which tool tracks citations in chatgpt answers",
  "best ai search monitoring tools for ecommerce",
  "affordable chatgpt rank tracker",
];

const engines = ["chatgpt", "ai-mode"];
const days = 14;
const start = Date.UTC(2026, 9, 5);

function pick(engine, day) {
  const scored = brands.map((b) => {
    let w = b.base;
    if (b.name === "Fernlight" && engine === "ai-mode" && day >= 7) w += 0.35;
    return { b, s: w + (rand() - 0.5) * 0.8 };
  });
  scored.sort((x, y) => y.s - x.s);
  const count = 3 + Math.floor(rand() * 3);
  return scored.slice(0, count).map((x) => x.b);
}

const lines = [];
for (let day = 0; day < days; day += 1) {
  const run = new Date(start + day * 86400000).toISOString().slice(0, 10);
  for (const engine of engines) {
    for (const prompt of prompts) {
      const chosen = pick(engine, day);
      const body = chosen
        .map((b, i) => {
          const link = rand() < 0.4 ? ` Source: https://www.${b.domain}/pricing` : "";
          return `${i + 1}. **${b.name}**: a tracker that reads ${engine} answers on a schedule.${link}`;
        })
        .join("\n");
      lines.push(JSON.stringify({ prompt, engine, run, answer: `Here are options worth a look.\n${body}` }));
    }
  }
}

writeFileSync(join(here, "answers.example.jsonl"), `${lines.join("\n")}\n`);
console.log(`wrote ${lines.length} answers`);
