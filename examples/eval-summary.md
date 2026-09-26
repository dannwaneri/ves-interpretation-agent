# Eval summary

Full results: [../eval/](../eval/) -- raw run JSON in `eval/results/`, questions in `eval/questions.json`, scorecard in `eval/results/scorecard--2026-09-26.md`.

9 questions, 3 reps per condition (54 runs total): structured agent vs. a
plain BM25 keyword-search baseline over the raw text of the three source
PDFs, same model, comparable prompt, no structure.

| | Structured (agent) | Baseline (BM25 keyword search) |
|---|---|---|
| Verdict accuracy | 27/27 (100%) | 15/27 (56%) |
| Conflict-detection accuracy | 27/27 (100%) | 23/27 (85%) |
| Run-to-run consistency | Perfect on all 9 questions | -- |

The clearest example of why structure matters: asked about the Kenpoly
sec-school-field side of the same table swap, the keyword baseline actually
**trusted the mislabeled value** (2950 ohm-m, which belongs to a different
station) as if it were correct for that station, because it has no way to
tell two textually-similar rows apart without the structured `site` /
`station` / `sourceLocation` fields the agent has.

Two real bugs were found and fixed via this eval (see the Phase 4 commit and
`eval/questions.json`'s `_correctionLog` for the full account):
- A curve-classifier false positive on genuinely-correct multi-layer A-type curves.
- A fabricated conflict that borrowed a different station's real documented issue by name similarity.

`eval/compare-offline.js` additionally checks `--offline` against the online
agent on the same 9 questions: 8/9 agree exactly, and the one disagreement
is a disclosed, inherent trade-off of a rule-based (no-LLM) mode rather than
a bug -- see [../eval/results/offline-vs-online--2026-09-26.md](../eval/results/offline-vs-online--2026-09-26.md).
