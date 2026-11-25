import test from "node:test";
import assert from "node:assert/strict";
import { positions, extractCitations, cites, score, stability, weekOf } from "../src/rank.mjs";

const brands = [
  { name: "Alpha", domains: ["alpha.test"] },
  { name: "Beta Labs", aliases: ["Beta"], domains: ["betalabs.test"] },
  { name: "Gamma", domains: ["gamma.test"] },
];

test("orderRank follows first mention in the text", () => {
  const p = positions("Try Gamma first, then Alpha.", brands);
  assert.deepEqual(p.map((x) => [x.name, x.orderRank]), [["Gamma", 1], ["Alpha", 2]]);
});

test("aliases match and substrings do not", () => {
  assert.equal(positions("Beta is fine", brands)[0].name, "Beta Labs");
  assert.equal(positions("Alphabet is not Alpha", brands).length, 1);
  assert.equal(positions("Alphabet only", brands).length, 0);
});

test("listRank reads the numbered list item that names the brand", () => {
  const answer = "Options:\n1. Gamma does X\n2. Alpha does Y\n3. Beta does Z";
  const byName = Object.fromEntries(positions(answer, brands).map((x) => [x.name, x.listRank]));
  assert.deepEqual(byName, { Gamma: 1, Alpha: 2, "Beta Labs": 3 });
});

test("citations are hostnames with www and trailing punctuation removed", () => {
  const text = "See [docs](https://www.alpha.test/pricing?utm=x) and https://app.gamma.test/a.";
  assert.deepEqual(extractCitations(text), ["alpha.test", "app.gamma.test"]);
});

test("cites matches the domain and its subdomains only", () => {
  assert.equal(cites("https://app.gamma.test/x", brands[2]), true);
  assert.equal(cites("https://notgamma.test/x", brands[2]), false);
});

test("score computes rates, mean rank and share of voice", () => {
  const rows = [
    { prompt: "p", engine: "chatgpt", run: "2026-10-05", answer: "Alpha then Gamma. https://alpha.test/" },
    { prompt: "p", engine: "chatgpt", run: "2026-10-06", answer: "Gamma then Alpha" },
    { prompt: "p", engine: "chatgpt", run: "2026-10-07", answer: "Only Gamma" },
    { prompt: "p", engine: "chatgpt", run: "2026-10-08", answer: "Nobody" },
  ];
  const [r] = score(rows, brands);
  assert.equal(r.answers, 4);
  assert.equal(r.mentionRate, 0.5);
  assert.equal(r.citationRate, 0.25);
  assert.equal(r.meanRank, 1.5);
  assert.equal(r.firstRate, 0.25);
  assert.equal(r.top3Rate, 0.5);
  assert.equal(r.shareOfVoice, 2 / 5);
});

test("score groups by engine", () => {
  const rows = [
    { prompt: "p", engine: "a", run: "2026-10-05", answer: "Alpha" },
    { prompt: "p", engine: "b", run: "2026-10-05", answer: "Gamma" },
  ];
  const out = score(rows, brands, { by: "engine" });
  assert.deepEqual(out.map((x) => [x.group, x.mentionRate]), [["a", 1], ["b", 0]]);
});

test("stability is 1 for identical runs and 0 for disjoint runs", () => {
  const same = [
    { prompt: "p", engine: "e", run: "2026-10-05", answer: "Alpha Gamma" },
    { prompt: "p", engine: "e", run: "2026-10-06", answer: "Alpha Gamma" },
  ];
  const diff = [
    { prompt: "p", engine: "e", run: "2026-10-05", answer: "Alpha" },
    { prompt: "p", engine: "e", run: "2026-10-06", answer: "Gamma" },
  ];
  assert.equal(stability(same, brands)[0].overlap, 1);
  assert.equal(stability(diff, brands)[0].overlap, 0);
});

test("weekOf gives ISO weeks", () => {
  assert.equal(weekOf("2026-10-05"), "2026-W41");
  assert.equal(weekOf("2026-01-01"), "2026-W01");
  assert.equal(weekOf("2027-01-03"), "2026-W53");
});
