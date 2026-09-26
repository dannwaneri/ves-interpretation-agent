# --offline vs online agreement

Generated 2026-09-26. Online column reuses each question's already-saved structured run 1 (not re-run). Offline uses a 3-way vocabulary (normal / anomalous / label mismatch) instead of online's (normal / anomalous / uncertain) by design -- "agrees" below means the verdicts describe the same real-world conclusion, not that the strings are identical.

| Question | Online verdict | Offline verdict | Agrees? |
|---|---|---|---|
| bori-table-swap-bmgs | normal | normal | yes |
| bori-table-swap-kenpoly | anomalous | anomalous | yes |
| choba-curve-type | anomalous | label mismatch | yes |
| etche-odufor-curve-type | anomalous | label mismatch | yes |
| etche-opiro-curve-type | anomalous | label mismatch | yes |
| etche-egwi-depth-arithmetic | anomalous | anomalous | yes |
| bori-court-road-control | normal | normal | yes |
| choba-depth-consistency-control | normal | label mismatch | **NO** |
| bori-kenpoly-convocation-control | normal | normal | yes |

## Totals

8/9 agree.

## Disagreements

- choba-depth-consistency-control: online=normal, offline=label mismatch

## Known, inherent limitation (not a bug)

choba-depth-consistency-control asks specifically about depth arithmetic at a station that ALSO has an unrelated, real curve-type mismatch. The online agent (LLM-driven) understands the question is about depth, not curve type, and correctly answers "normal" on the thing actually asked. Offline mode has no language understanding -- it runs a fixed rule order (curve-type check, then depth-arithmetic check) and reports the first issue it finds for the station regardless of the question's wording, so it always surfaces the curve-type mismatch here. This is a disclosed trade-off of a rule-based, no-LLM mode, not a fixable defect: a genuinely offline tool can tell you everything known about a station, but can't parse what you actually asked.
