# Eval scorecard

Generated 2026-09-26. 54 total runs, 3 reps per question per condition.

| Question | Cond | Verdict runs (expected: **VERDICT**) | Verdict score | Consistent across reps? | Conflict score |
|---|---|---|---|---|---|
| bori-table-swap-bmgs | structured | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=true) |
| bori-table-swap-bmgs | baseline | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=true) |
| bori-table-swap-kenpoly | structured | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| bori-table-swap-kenpoly | baseline | uncertain, uncertain, uncertain (expected: **anomalous**) | 0/3 | yes | 2/3 (expected conflict=true) |
| choba-curve-type | structured | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| choba-curve-type | baseline | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| etche-odufor-curve-type | structured | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| etche-odufor-curve-type | baseline | uncertain, uncertain, uncertain (expected: **anomalous**) | 0/3 | yes | 0/3 (expected conflict=true) |
| etche-opiro-curve-type | structured | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| etche-opiro-curve-type | baseline | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=true) |
| etche-egwi-depth-arithmetic | structured | anomalous, anomalous, anomalous (expected: **anomalous**) | 3/3 | yes | 3/3 (expected conflict=false) |
| etche-egwi-depth-arithmetic | baseline | uncertain, uncertain, uncertain (expected: **anomalous**) | 0/3 | yes | 3/3 (expected conflict=false) |
| bori-court-road-control | structured | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=false) |
| bori-court-road-control | baseline | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=false) |
| choba-depth-consistency-control | structured | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=false) |
| choba-depth-consistency-control | baseline | uncertain, uncertain, uncertain (expected: **normal**) | 0/3 | yes | 3/3 (expected conflict=false) |
| bori-kenpoly-convocation-control | structured | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=false) |
| bori-kenpoly-convocation-control | baseline | normal, normal, normal (expected: **normal**) | 3/3 | yes | 3/3 (expected conflict=false) |

## Totals

- Structured verdict accuracy: 27/27 (100%)
- Baseline verdict accuracy: 15/27 (56%)
- Structured conflict-detection accuracy: 27/27 (100%)
- Baseline conflict-detection accuracy: 23/27 (85%)

## Every failure (not tuned away)

- bori-table-swap-kenpoly / baseline: 3/3 run(s) gave the wrong verdict (expected anomalous, got uncertain, uncertain, uncertain)
- bori-table-swap-kenpoly / baseline: 1/3 run(s) got conflict detection wrong (expected conflict=true, got [true, false, true])
- etche-odufor-curve-type / baseline: 3/3 run(s) gave the wrong verdict (expected anomalous, got uncertain, uncertain, uncertain)
- etche-odufor-curve-type / baseline: 3/3 run(s) got conflict detection wrong (expected conflict=true, got [false, false, false])
- etche-egwi-depth-arithmetic / baseline: 3/3 run(s) gave the wrong verdict (expected anomalous, got uncertain, uncertain, uncertain)
- choba-depth-consistency-control / baseline: 3/3 run(s) gave the wrong verdict (expected normal, got uncertain, uncertain, uncertain)
