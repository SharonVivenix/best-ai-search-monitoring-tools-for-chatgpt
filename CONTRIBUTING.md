# Contributing

This repo compares ChatGPT trackers by how they collect answers and what they let you export. The most useful contribution is a corrected plan fact with a link to the vendor page that shows it.

## Change the data, then regenerate

1. Edit `tools.json`. Each entry describes the entry plan only.
2. Use the text `Not published` for any field the vendor does not state. Do not guess.
3. Set `readsAiMode` to true only when the vendor lists Google AI Mode as a tracked engine.
4. Run `node render_table.mjs --write`, then `node render_table.mjs --check`.
5. Open a pull request with the vendor link.

## Accepted

* Price, plan, engine or trial changes with a source link.
* A published collection method for a tool marked `Not published`.
* A new tool, if its pricing page shows an entry plan.

## Not accepted

* Affiliate or tracking links.
* Review scores and star ratings.
* Currency conversions. Keep the currency the vendor publishes.

## Code

`src/rank.mjs` has no dependencies and must run on Node 18. New metrics go there with a test in `test/rank.test.mjs` that checks a hand computed value. If you change `examples/make_sample.mjs`, rerun it and update the numbers quoted in the README.

```bash
node render_table.mjs --check
node --test test/
node examples/make_sample.mjs
```
