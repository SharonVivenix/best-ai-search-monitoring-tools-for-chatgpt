// Turn stored ChatGPT answers into rank, citation and stability numbers.
// Zero dependencies. Node 18 or newer.

/** @typedef {{name: string, aliases?: string[], domains?: string[]}} Brand */
/** @typedef {{prompt: string, engine: string, run: string, answer: string}} Row */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case insensitive whole word matcher for a brand name and its aliases. */
function brandPattern(brand) {
  const names = [brand.name, ...(brand.aliases ?? [])].map(esc);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

/** Hostname without www, or null when the string is not a URL. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Every URL in an answer, markdown links and bare links, as hostnames. */
export function extractCitations(text) {
  const urls = text.match(/https?:\/\/[^\s)>\]"']+/g) ?? [];
  return urls.map((u) => hostOf(u.replace(/[.,;:]+$/, ""))).filter(Boolean);
}

/**
 * Where each brand sits in one answer.
 * orderRank: 1 for the brand named first in the text, 2 for the next, and so on.
 * listRank: the number of the first numbered list item that names the brand, or null.
 */
export function positions(answer, brands) {
  const hits = [];
  for (const b of brands) {
    const m = brandPattern(b).exec(answer);
    if (m) hits.push({ name: b.name, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);
  const items = [...answer.matchAll(/^\s*(\d+)[.)]\s+(.*)$/gm)].map((m) => ({
    n: Number(m[1]),
    text: m[2],
  }));
  return hits.map((h, i) => {
    const brand = brands.find((b) => b.name === h.name);
    const re = brandPattern(brand);
    const item = items.find((it) => re.test(it.text));
    return { name: h.name, orderRank: i + 1, listRank: item ? item.n : null };
  });
}

/** Does the answer link to one of the brand's own domains? */
export function cites(answer, brand) {
  const own = (brand.domains ?? []).map((d) => d.toLowerCase());
  return extractCitations(answer).some((h) => own.some((d) => h === d || h.endsWith(`.${d}`)));
}

/** ISO week label such as 2026-W41, from a YYYY-MM-DD run date. */
export function weekOf(run) {
  const d = new Date(`${run}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const keyers = {
  overall: () => "all answers",
  prompt: (r) => r.prompt,
  engine: (r) => r.engine,
  week: (r) => weekOf(r.run),
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Score one brand over a log.
 * @param {Row[]} rows
 * @param {Brand[]} brands the first entry is the brand you track, the rest are competitors
 * @param {{by?: "overall"|"prompt"|"engine"|"week"}} opts
 */
export function score(rows, brands, { by = "overall" } = {}) {
  const key = keyers[by];
  if (!key) throw new Error(`unknown grouping: ${by}`);
  const target = brands[0];
  const groups = new Map();
  for (const row of rows) {
    const k = key(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(row);
  }
  const out = [];
  for (const [k, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const ranks = [];
    let mentioned = 0;
    let cited = 0;
    let top3 = 0;
    let first = 0;
    let mentionsAll = 0;
    for (const row of g) {
      const pos = positions(row.answer, brands);
      mentionsAll += pos.length;
      const mine = pos.find((p) => p.name === target.name);
      if (mine) {
        mentioned += 1;
        ranks.push(mine.orderRank);
        if (mine.orderRank <= 3) top3 += 1;
        if (mine.orderRank === 1) first += 1;
      }
      if (cites(row.answer, target)) cited += 1;
    }
    const n = g.length;
    out.push({
      group: k,
      answers: n,
      mentionRate: mentioned / n,
      citationRate: cited / n,
      meanRank: mean(ranks),
      top3Rate: top3 / n,
      firstRate: first / n,
      shareOfVoice: mentionsAll ? mentioned / mentionsAll : 0,
    });
  }
  return out;
}

const topSet = (answer, brands, k) =>
  new Set(positions(answer, brands).filter((p) => p.orderRank <= k).map((p) => p.name));

function jaccard(a, b) {
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let both = 0;
  for (const x of a) if (b.has(x)) both += 1;
  return both / union.size;
}

/**
 * Run to run stability. For each prompt and engine, sort the runs by date and compare
 * the top k brand set of every run with the next one. 1 means the same brands every time,
 * 0 means no overlap.
 */
export function stability(rows, brands, { k = 3 } = {}) {
  const cells = new Map();
  for (const row of rows) {
    const id = `${row.prompt}\u0000${row.engine}`;
    if (!cells.has(id)) cells.set(id, []);
    cells.get(id).push(row);
  }
  const result = [];
  for (const [id, g] of cells) {
    const [prompt, engine] = id.split("\u0000");
    const runs = g.sort((a, b) => a.run.localeCompare(b.run));
    const sims = [];
    for (let i = 1; i < runs.length; i += 1) {
      sims.push(jaccard(topSet(runs[i - 1].answer, brands, k), topSet(runs[i].answer, brands, k)));
    }
    result.push({ prompt, engine, runs: runs.length, overlap: mean(sims) });
  }
  return result.sort((a, b) => (a.overlap ?? 2) - (b.overlap ?? 2));
}
