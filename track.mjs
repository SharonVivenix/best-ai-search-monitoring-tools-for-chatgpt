#!/usr/bin/env node
// Score a JSONL log of ChatGPT answers.
//
//   node track.mjs examples/answers.example.jsonl --brands examples/brands.example.json
//   node track.mjs <log> --brands <file> --by engine
//   node track.mjs <log> --brands <file> --stability
//
// One JSON object per line: {"prompt": "...", "engine": "chatgpt", "run": "2026-10-01", "answer": "..."}
// The first brand in the brands file is the one being tracked.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { score, stability } from "./src/rank.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    brands: { type: "string" },
    by: { type: "string", default: "overall" },
    stability: { type: "boolean", default: false },
    k: { type: "string", default: "3" },
  },
});

if (!positionals[0] || !values.brands) {
  console.error("usage: node track.mjs <answers.jsonl> --brands <brands.json> [--by overall|prompt|engine|week] [--stability]");
  process.exit(2);
}

const rows = readFileSync(positionals[0], "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l, i) => {
    try {
      return JSON.parse(l);
    } catch {
      throw new Error(`line ${i + 1} is not valid JSON`);
    }
  });
const brands = JSON.parse(readFileSync(values.brands, "utf8"));

const pct = (x) => `${(100 * x).toFixed(0)}%`;
const pad = (s, n) => String(s).padEnd(n);

if (values.stability) {
  const k = Number(values.k);
  console.log(`Top ${k} overlap between consecutive runs (1.00 means identical brand sets)\n`);
  for (const s of stability(rows, brands, { k })) {
    console.log(`${pad(s.engine, 10)} ${s.overlap === null ? " n/a" : s.overlap.toFixed(2)}  runs=${s.runs}  ${s.prompt}`);
  }
  process.exit(0);
}

const tracked = brands[0].name;
const result = score(rows, brands, { by: values.by });
const width = Math.min(48, Math.max(...result.map((r) => r.group.length), 5));
console.log(`Brand: ${tracked}   answers: ${rows.length}\n`);
console.log(`${pad(values.by, width)}  answers  mention  cited  meanRank  top3  first  SoV`);
for (const r of result) {
  const rank = r.meanRank === null ? "  n/a" : r.meanRank.toFixed(2).padStart(5);
  console.log(
    `${pad(r.group.slice(0, width), width)}  ${String(r.answers).padStart(7)}  ${pct(r.mentionRate).padStart(7)}  ${pct(r.citationRate).padStart(5)}  ${rank.padStart(8)}  ${pct(r.top3Rate).padStart(4)}  ${pct(r.firstRate).padStart(5)}  ${pct(r.shareOfVoice).padStart(3)}`,
  );
}
