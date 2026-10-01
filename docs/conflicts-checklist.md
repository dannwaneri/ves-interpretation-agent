# Conflicts checklist (Phase 6)

All 14 conflicts Sanity Context has found and resolved while building the
VES Interpretation Knowledge Base. The first 7 were pulled from Context →
VES Interpretation KB → Issues → Resolved, on 2026-09-26. An 8th (#8 below)
surfaced from a routine Context re-scan on 2026-09-28, before any Phase 8
change. #9-#11 surfaced after the Phase 8 purpose text was applied and the
KB rebuilt (this rebuild regenerated the entries with a new structure,
including a new `normalcy_verdicts` entry, which introduced its own fresh
errors, the same category of adjacent-station data bleed as #5/#6, just in
newly generated content). #12-#14 surfaced across two further rebuilds on
2026-09-30, triggered while resolving the issue immediately before each:
resolving one issue's standing instruction changed what the next rebuild
generated enough to surface a fresh Issue, three times in a row, before a
final rebuild came back clean (0 pending). Each one is marked **REAL** (a
genuine error in the published paper) or **ARTIFACT** (Context flagged
something that isn't actually a problem, including its own generation
errors, which are real bugs but not paper errors).

All 14 verified below against the actual extracted PDF text (`eval/paper-text/*.txt`) and/or live `groq_query` against the dataset, on 2026-09-28 (#1-11) and 2026-09-30 (#12-14).

- [x] **1. REAL**, PDF-verified
- [x] **2. REAL**, PDF-verified
- [x] **3. REAL**, PDF-verified (same fact as #1)
- [x] **4. ARTIFACT**, PDF-verified false pairing
- [x] **5. ARTIFACT**, KB-generation bug, confirmed against PDF
- [x] **6. ARTIFACT**, KB-generation bug, confirmed against PDF
- [x] **7. ARTIFACT**, confirmed accurate, not a paper error
- [x] **8. REAL**, PDF-verified (same fact as #1)
- [x] **9. ARTIFACT**, KB-generation bug, confirmed against PDF
- [x] **10. ARTIFACT**, KB-generation bug, confirmed against PDF
- [x] **11. ARTIFACT**, KB-generation gap, confirmed against PDF
- [x] **12. REAL**, PDF-verified (same fact as #1, re-surfaced)
- [x] **13. REAL**, PDF-verified (Etche Odufor curve-type mislabel, first time Context caught this one)
- [x] **14. ARTIFACT**, KB-generation bug, confirmed against PDF

---

## 1. BMGS Bori Field resistivity swap (via Cross-Site Aquifer Benchmarks)

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry reports BMGS-bori-field aquifer resistivity as 2950 Ω·m, but the Cross-Site Aquifer Resistivity Benchmarks entry cites 2950 Ω·m while also noting that the Bori paper's summary table contains swapped station-name labels, with the row labeled 'BMGS bori field' actually carrying Kenpoly data (3706 Ω·m).

- One entry says: **2950 Ω·m** (BMGS Bori Field)
- Another entry says: **3706 Ω·m** (mislabeled as BMGS, actually Kenpoly)

**Source / page:** Menegbo et al. (2024), Bori Metropolis paper. 2950 Ω·m comes from Figure 2 panel caption + p.3 coordinate table; 3706 Ω·m comes from p.7 Table 1 (summary table), row printed "BMGS bori field".

**PDF verification: REAL.** Confirmed directly from `eval/paper-text/bori.txt`. The paper's own p.3 coordinate table (Table 1, "Location of the VES stations") lists:
```
Kenpoly sec school field   7.37207889   4.665453
BMGS bori field            7.36096      4.67842
```
The paper's own p.7 summary table lists:
```
BMGS bori field            7.37207889   4.665453   3706   59.3   32.2
Kenpoly sec school field   7.36096      4.67842    2950   66.5   36.2
```
The summary table's "BMGS bori field" row carries the coordinates that the coordinate table assigns to Kenpoly sec school field, and vice versa. The row labels are swapped against the paper's own coordinate table. This is unambiguous and internal to the paper; no external source needed. True BMGS value: 2950 Ω·m. True Kenpoly sec school field value: 3706 Ω·m.

**Resolution:** Saved as an instruction shaping future rebuilds.

---

## 2. Choba Lawn Tennis Field curve-type mislabel

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Choba entry states that the Lawn Tennis Field station is labeled A-type in the paper, but the Curve-Type Classification Errors entry and the Curve-Type Definitions entry both identify this as a mislabeled non-monotonic sequence that should not be classified as A-type.

- One entry says: **A-type** (as published)
- Another entry says: **unclassified** (non-monotonic, not A-type)

**Source / page:** Oghonyon et al. (2025), Table 5 (values) and Discussion/Conclusion sections (aquifer designation, curve label). Layer resistivities: 91.2 → 380.2 → 43.25 → 474.3 → 597.1 Ω·m, confirmed non-monotonic (a dip at layer 3) by `agent/curveType.js`'s `deriveCurveType()`, which derives "KHA", not "A".

**PDF verification: REAL.** Confirmed directly from `eval/paper-text/choba.txt`. Table 5 gives exactly 91.2, 380.2, 43.25, 474.3, 597.1 Ω·m. The Discussion section then says, in the same paragraph: *"The resistivity trend is in the form of l1<l2>l3<l4<l5. The resistivity trends observed in Figure 2 follows an A-type curve pattern, defined by progressive increase in resistivity with depth."* The paper states the non-monotonic trend (a drop at layer 3) and calls it "A-type... progressive increase" in the same sentence. This is a direct, internal self-contradiction in the published text, not an inference.

**Resolution:** Saved as an instruction shaping future rebuilds.

---

## 3. BMGS Bori Field resistivity swap (via aquifer_benchmarks + source_errors)

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry lists BMGS-Bori-Field with an aquifer resistivity of 2950 Ω·m, but the aquifer_benchmarks entry and source_errors/data_inconsistencies entry indicate that the station labeled "BMGS bori field" in the paper's summary table actually has an aquifer resistivity of 2950 Ω·m according to Figure 2 panel (c), while the row labeled "BMGS bori field" in Table 1 carries data for Kenpoly (3706 Ω·m).

- One entry says: **2950 Ω·m** (BMGS-Bori-Field)
- Another entry says: **2950 Ω·m** (mislabeled as Kenpoly in Table 1)

**Source / page:** Same underlying fact as #1, detected as a separate Issue because a third entry (`aquifer_benchmarks`, `source_errors/data_inconsistencies`) also states it. Same source: p.7 Table 1 vs Figure 2 panel (c) / p.3 coordinate table.

**Resolution:** Saved as an instruction shaping future rebuilds.

**PDF verification: REAL.** Same underlying fact as #1, see there for the exact quoted tables.

**Note:** #1 and #3 both describe the same real-world BMGS/Kenpoly swap. Context raised it twice because three or more entries independently state the fact and it compares pairwise. When verifying against the PDF, one check covers both.

---

## 4. Kenpoly Convocation Arena vs. Kenpoly sec school field: PDF-verified as a false pairing

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry lists Kenpoly-convocation-arena with an aquifer resistivity of 3488 Ω·m, but the Bori Low-to-Moderate Resistivity Stations entry and the source-errors/data_inconsistencies entry indicate that the station labeled "Kenpoly sec school field" in the paper's summary table actually has an aquifer resistivity of 3706 Ω·m (from the paper's Figure 2 and coordinate table).

- One entry says: **3488 Ω·m**
- Another entry says: **3706 Ω·m**

**Source / page:** Kenpoly-convocation-arena's own reading: 3488 Ω·m, Figure 2 panel caption. Kenpoly-sec-school-field's true value: 3706 Ω·m, its own Figure 2 panel caption.

**PDF verification: ARTIFACT.** Confirmed from `eval/paper-text/bori.txt`'s p.7 summary table: `Kenpoly convocation arena field 7.37414778 4.667667 3488 50.2 24.3`, coordinates matching its OWN row in the p.3 coordinate table exactly, no swap involved. "Kenpoly Convocation Arena" and "Kenpoly sec school field" are two genuinely **different, real stations**, each with its own uncontested, correctly-labeled reading (3488 for Convocation Arena, 3706 for sec-school-field once #1's swap is corrected). This Issue paired them purely because both names contain "Kenpoly," the same category of name-similarity confusion documented in `examples/bori-demo.md` (the agent itself fabricated a conflict this way before being fixed). Not a paper error.

**Resolution:** Originally saved as an instruction shaping future rebuilds. Since the PDF verification above shows this was a non-conflict (two different, correctly-labeled stations, not a real disagreement), that instruction was deleted from the Context app on 2026-09-29, screenshotted first as evidence. Deleting it reopened the Issue in a correctly-scoped form (the `normalcy_verdicts` entry's own number for Kenpoly sec school field vs. that station's own source reading, not station-vs-station), which was then resolved keeping the true value, 3706 Ω·m. The Knowledge Base was rebuilt, and the 3 eval questions touching these two stations (`bori-table-swap-bmgs`, `bori-table-swap-kenpoly`, `bori-kenpoly-convocation-control`) were re-run live against the rebuilt KB: all 3 verdicts, trusted values, and conflict framing came back unchanged. See the README's Limitations section.

---

## 5. Kor-road layer model duplicated into Kenpoly Convocation Arena's section

**Scope:** Bori High-Resistivity Aquifer Stations entry | **Kind:** Conflict | **Severity:** Critical

> The full layer model section for Kor-road is correct, but it is duplicated identically for Kenpoly-convocation-arena, which should show a 5-layer model with aquifer at layer 4 (3488 Ω·m). The two stations have been conflated in the full layer models section.

**What the entry said (Kor-road section):** Layer 1: 1.24 m @ 1916 Ω·m | Layer 2: 1.79 m @ 1252 Ω·m | Layer 3 (aquifer): 108 m @ 1658 Ω·m | Layer 4: 581 Ω·m (basement). Correct.

**What the source says (`reading-bori-kor-road`):** Same model, confirmed correct.

**PDF verification: ARTIFACT.** Kor-road's own p.7 summary-table row (`eval/paper-text/bori.txt`): `Kor road 7.379798 4.676532 1658 111 108`, matching its own p.3 coordinates exactly (no swap for this station) and matching `reading-bori-kor-road`'s dataset values exactly (1658 Ω·m, 111 m, 108 m). The paper itself is correct here; the entry's copy-paste error is purely a KB-generation artifact.

**Note:** This one is about the *KB entry's own generated text*, not a paper-transcription error. Kor-road's numbers got copy-pasted under Kenpoly-convocation-arena's heading during entry generation. See #6, the same bug described from the other side.

**Resolution:** The entry is being updated, saved as an instruction for future rebuilds.

---

## 6. Kenpoly Convocation Arena's layer model didn't match its own source

**Scope:** Bori High-Resistivity Aquifer Stations entry | **Kind:** Conflict | **Severity:** Critical

> The layer model listed for Kenpoly-convocation-arena in the entry does not match the source. The source shows layer 4 as the aquifer at 3488 Ω·m, not layer 3 at 1658 Ω·m. The listed model appears to belong to Kor-road instead.

**What the entry said (Kenpoly-convocation-arena section, before fix):** Layer 1: 1.24 m @ 1916 Ω·m | Layer 2: 1.79 m @ 1252 Ω·m | Layer 3 (aquifer): 108 m @ 1658 Ω·m | Layer 4+: 581 Ω·m. This is Kor-road's model, wrongly filed under Kenpoly.

**What the source says (`reading-bori-kenpoly-convocation-arena`):** Layer 1: 2.5 m @ 1434 Ω·m | Layer 2: 5.42 m @ 1879 Ω·m | Layer 3: 18 m @ 318 Ω·m | Layer 4 (aquifer): 24.3 m @ 3488 Ω·m | Layer 5 (basement): 542 Ω·m. Reported aquifer resistivity 3488 Ω·m at 50.2 m depth.

**PDF verification: ARTIFACT.** See #5, same underlying bug (Kor-road's numbers, not Kenpoly Convocation Arena's, per the p.7 table quoted there), the KB entry's own generated content, not a paper error.

**Resolution:** The entry is being updated, saved as an instruction for future rebuilds.

---

## 7. Eight Etche stations claim: confirmed accurate, not a real conflict

**Scope:** Cross-Site Aquifer Resistivity Benchmarks entry | **Kind:** Conflict | **Severity:** (not critical)

> The body's claim of eight Etche stations is actually correct and matches the source, so there is no conflict here. This appears to be accurate.

**What the entry says:** Etche (2022): Eight survey stations (Opiro, Odufor, Ndashi, Umuokom, Egwi, Ulakwo, Okehi, Akpoku) with layer-by-layer resistivity, depth, and thickness data from Tables 1-8.

**What the source says:** Confirms all 8 station names match: Opiro, Odufor, Egwi, Ulakwo, Okehi, Akpoku, Ndashi, Umuokom.

**Source / page:** Nwankwoala et al. (2022), Etche LGA paper, Tables 1-8.

**PDF verification: ARTIFACT (confirmed accurate).** `eval/paper-text/etche.txt` line 69: *"...includes Ndashi, Umuokom, Akporku, Okehi, Odufor, Egwi, Ulakwo and Opiro"*, all 8 names present, matching the entry's claim exactly. This is Context's own false-positive, flagged then confirmed accurate on review; no paper error.

---

## 8. BMGS Bori Field resistivity swap (via Depth Arithmetic & Station Label Errors, post-rebuild)

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Stations entry reports BMGS-bori-field aquifer resistivity as 2950 Ω·m, but the Data Inconsistencies entry states that the paper's summary table row labeled 'BMGS bori field' actually carries data for Kenpoly (3706 Ω·m), while the row labeled 'Kenpoly sec school field' carries BMGS bori field's actual data (2950 Ω·m).

- One entry says (Bori High-Resistivity Aquifer Stations): **BMGS-bori-field aquifer resistivity is 2950 Ω·m.**
- Another entry says (Depth Arithmetic & Station Label Errors): **The paper's summary table row labeled 'BMGS bori field' contains 3706 Ω·m, but this is actually Kenpoly's data due to a label swap.**

**Source / page:** Same underlying fact as #1 and #3, detected a third time on a routine Context re-scan (shown under the entries' display titles, "Bori High-Resistivity Stations" and "Data Inconsistencies," rather than their `path`-style identifiers).

**PDF verification: REAL.** Same underlying fact as #1, see there for the exact quoted tables.

**Resolution:** Kept 2950 Ω·m for BMGS-Bori-Field. The two entries don't actually disagree; the second is explicitly explaining why the swapped 3706 Ω·m value doesn't belong to BMGS, not asserting a different value for it. Resolved as such.

---

## 9. Bank-road layer 3 depth: Kor-road's number bled into a newly generated entry

**Scope:** Bori Road-Named Station Readings entry | **Kind:** Conflict | **Severity:** Critical

> The entry states Bank-road layer 3's cumulative depth is 111-18 m, but the reading shows 97.9-13.8 m (bottom-top cumulative depth).

**Verified live against the dataset** (`groq_query` on `reading-bori-bank-road`, 2026-09-28): layer 2 cumulative depth 13.8 m, layer 3 cumulative depth 97.9 m. Matches the Issue's own "the reading shows" claim exactly. The entry's "111" figure matches nothing in Bank-road's own data; it's Kor-road's own layer 3 cumulative depth (`reading-bori-kor-road`, 111 m exactly). Same category of bug as #5/#6 (an adjacent station's numbers bleeding into a different station's section during entry generation), this time in the `Bori Road-Named Station Readings` entry created by the Phase 8 rebuild.

**PDF verification: ARTIFACT.** `eval/paper-text/bori.txt`'s p.7 summary table: `Bank road 7.36616 4.67171 2594 97.9 84.1`, coordinates matching its own p.3 entry exactly. The paper's own numbers are correct; only the KB entry's generated text was wrong.

**Resolution:** Kept 97.9-13.8 m (the reading's real value).

---

## 10. Kenpoly sec school field resistivity: reassigned to the wrong station again

**Scope:** Aquifer Resistivity Normalcy Verdicts by Site entry (`normalcy_verdicts`) | **Kind:** Conflict | **Severity:** Critical

> The normalcy_verdicts entry states Kenpoly sec school field's aquifer resistivity is 3488 Ω·m, but the cited Menegbo et al. (2024) paper shows Kenpoly sec school field is 3706 Ω·m (from Figure 2, confirmed by coordinates). The 3488 Ω·m value actually belongs to Kenpoly Convocation Arena, a separate station.

This is the third time in this project's history that Kenpoly Convocation Arena and Kenpoly sec school field, two different real stations, have been conflated: once by the agent's own code (fixed in Phase 4/5, see `examples/bori-demo.md`), once in Issue #4 above, and now in a newly generated `normalcy_verdicts` entry from the Phase 8 rebuild. The Issue's own description already states the correct resolution.

**PDF verification: ARTIFACT.** Same underlying fact as #4's true resolution: PDF-confirmed (see #1) that Kenpoly sec school field's true value is 3706 Ω·m, and Kenpoly Convocation Arena's own, unrelated true value is 3488 Ω·m. The `normalcy_verdicts` entry's error, not a paper error.

**Resolution:** Kept 3706 Ω·m for Kenpoly sec school field (its own Figure 2 value, confirmed by coordinates). 3488 Ω·m stays correctly assigned to Kenpoly Convocation Arena.

---

## 11. Choba resistivity: a gap in the new entry, not a real competing value

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Choba station_readings entry reports the aquifer resistivity as 474.3 Ω·m (layer 4), but the normalcy_verdicts entry states it as "value not extracted in source register."

Not a value disagreement; `normalcy_verdicts` simply failed to extract Choba's number during generation. 474.3 Ω·m is confirmed correct throughout this project (`reading-choba-choba-lawntennisfield`, used in every Choba eval question and example).

**PDF verification: ARTIFACT.** `eval/paper-text/choba.txt` Table 5, layer 4: 474.3 Ω·m at 71.78 m depth, exactly matching the dataset. The paper reports this value clearly; the gap is in the `normalcy_verdicts` entry's generation, not the source.

**Resolution:** Kept 474.3 Ω·m.

---

## 12. Kenpoly Sec School Field, 3706 Ω·m: the Bori swap, re-surfaced a third time

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori group-a entry states Kenpoly Sec School Field has aquifer resistivity 3706 Ω·m (from Figure 2 panel b), but the Bori group-b entry and the swapped-labels entry indicate that the paper's Table 1 summary table incorrectly assigns this value to the BMGS Bori Field row due to swapped labels.

Both cited entries actually agree that 3706 Ω·m belongs to Kenpoly Sec School Field; there is no real disagreement in value here, only an explanation of why the p.7 table mislabels it. Same underlying fact as #1/#3/#8, surfaced again by a later rebuild.

**PDF verification: REAL** (same fact as #1). `eval/paper-text/bori.txt`'s p.3 coordinate table gives Kenpoly Sec School Field's true coordinates as `7.37207889 4.665453` and BMGS Bori Field's as `7.36096 4.67842`. The p.7 summary table's row printed "BMGS bori field" (`7.37207889 4.665453 3706 59.3 32.2`) carries Kenpoly's own coordinates exactly, confirming that row's data (3706 Ω·m, 59.3 m depth, 32.2 m thickness) truly belongs to Kenpoly Sec School Field, not BMGS. The row printed "Kenpoly sec school field" (`7.36096 4.67842 2950 66.5 36.2`) carries BMGS's own coordinates exactly, confirming that row's data (2950 Ω·m, 66.5 m depth, 36.2 m thickness) truly belongs to BMGS. This is the same p.7 label swap as #1, confirmed by coordinate matching rather than assumed.

**Resolution:** Kept 3706 Ω·m for Kenpoly Sec School Field.

---

## 13. Etche Odufor: Context catches the curve-type mislabel for the first time

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Etche station entry lists Odufor as A-type in its summary table, but the Curve-Type Classification Reference and source-error entries document that Odufor's layer data show a dip at layer 4, contradicting the A-type definition and making the correct classification unclassified.

The "Odufor is A-type" claim is itself sourced from the wrong stations' reading documents (`reading-etche-akpoku`, `reading-etche-ndashi`, `reading-etche-okehi`, `reading-etche-umuokom`, `reading-etche-ulakwo`, none of them Odufor's own reading), the same category of KB-generation content bleed as #5/#6/#9/#14. The competing claim, correctly sourced from `reading-etche-odufor` itself, is the one that matches the paper.

**PDF verification: REAL.** `eval/paper-text/etche.txt` Table 5 (Odufor): layer 1: 20.320, layer 2: 851.16, layer 3: 2511.9, layer 4: 1345.0 Ω·m. Layer 4 (1345.0) is lower than layer 3 (2511.9), a non-monotonic dip, exactly as this Issue cites. This is Real error #3 from Table B below (Etche Odufor's curve-type mislabel), previously caught only by `agent/curveType.js` and never raised as a Context Issue until this rebuild. Table B's "Found by" column for this error is updated accordingly.

**Why this, and not Opiro too?** Checked live: `reading-etche-odufor` and `reading-etche-opiro` both carry an identical, pre-existing `transcriptionNote` field stating their own dip and "unclassified" status (confirmed via `groq_query`, 2026-10-01). Same-fact detection had equal structured material to work with for both stations from the start; nothing about Odufor's data made it more detectable. The entry Context generated on this specific rebuild only picked up Odufor's note. The current `source_errors/curve_type_mislabeling` entry (checked live, same date) correctly lists both Odufor and Opiro as unclassified, so this has since self-corrected on a later rebuild without a new Issue being raised for Opiro. This is a generation-coverage gap, not evidence that same-fact detection reasoned its way to one station and not the other.

**Resolution:** Kept "unclassified" for Odufor (non-monotonic; does not meet the A-type definition).

---

## 14. BMGS Bori Field thickness: another adjacent-station bleed, not a paper error

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The High-Resistivity Bori Stations entry reports BMGS-Bori-Field aquifer thickness as 36.8 m, while the Aquifer Resistivity Normalcy Verdicts entry lists it as 36.2 m.

The 36.8 m claim is sourced from a "High-Resistivity Bori Stations" entry citing eight different stations' reading documents at once (Kenpoly Convocation Arena, BMGS Bori Field, Bank-road, Gokana-street, Tigidam-street, Monokpo-street, Kor-road, Maakoro-street), not cleanly isolated to BMGS's own reading, the same fingerprint as #5/#6/#9: a value bleeding in from an adjacent station during entry generation.

**PDF verification: ARTIFACT.** Per #12's coordinate-matched resolution, BMGS Bori Field's true p.7 row (matched by its own p.3 coordinates, `7.36096 4.67842`) reports thickness 36.2 m. Confirmed independently live: the online agent's own `reportedAquiferThicknessM` for `reading-bori-bmgs-bori-field` prints 36.2 m in the real, unedited CLI output used for this project's demo recording. 36.8 m matches nothing in BMGS's own data; it is a KB-generation artifact, not a paper error.

**Resolution:** Kept 36.2 m for BMGS Bori Field.

---

## Table A: every Context Issue, mapped

14 Issues total. 6 of them (1, 2, 3, 8, 12, 13) map to a real error in the
source papers; the other 8 are artifacts, most of them the Knowledge Base's
own entry-generation bugs rather than anything wrong with the source papers.

| # | Station(s) | What's in question | Maps to | Verdict |
|---|---|---|---|---|
| 1 | BMGS Bori Field | 2950 vs 3706 Ω·m table swap | Real error #1 (Bori swap) | **REAL** |
| 2 | Choba Lawn Tennis Field | A-type label vs non-monotonic data | Real error #2 (Choba curve-type) | **REAL** |
| 3 | BMGS Bori Field | Same swap as #1, via a different entry pairing | Real error #1 | **REAL** |
| 4 | Kenpoly Convocation Arena vs Kenpoly sec school field | Two different, correctly-labeled stations paired as if competing | None (false pairing) | **ARTIFACT** |
| 5 | Kor-road / Kenpoly Convocation Arena | KB entry's own generated text had a copy-paste error | None (KB-generation bug) | **ARTIFACT** |
| 6 | Kenpoly Convocation Arena / Kor-road | Same bug as #5, other side | None (KB-generation bug) | **ARTIFACT** |
| 7 | Etche (8 stations) | False positive, confirmed accurate | None (confirmed accurate) | **ARTIFACT** |
| 8 | BMGS Bori Field | Same swap as #1/#3, re-surfaced on a later re-scan | Real error #1 | **REAL** |
| 9 | Bank-road | KB entry's own generated text had a copy-paste error (Kor-road's number bled in) | None (KB-generation bug) | **ARTIFACT** |
| 10 | Kenpoly sec school field | Same station-name confusion as #4, in a freshly generated entry | None (KB-generation bug) | **ARTIFACT** |
| 11 | Choba Lawn Tennis Field | Missing value in a new entry, not a conflicting one | None (KB-generation gap) | **ARTIFACT** |
| 12 | Kenpoly Sec School Field | Same swap as #1/#3/#8, re-surfaced on a further rebuild | Real error #1 | **REAL** |
| 13 | Etche Odufor | A-type label vs non-monotonic data, sourced from the wrong stations' readings | Real error #3 (Etche Odufor curve-type) | **REAL** |
| 14 | BMGS Bori Field | 36.2 vs 36.8 m thickness, sourced from eight stations' readings at once | None (KB-generation bug) | **ARTIFACT** |

## Table B: every internal inconsistency in the papers

10 internal inconsistencies across the 3 papers, not 3 and not 7. Each
listed once, with its exact source and which check actually caught it.
"Context" means Sanity Context's own build-time same-fact conflict
detector raised an Issue for it. "Code" means `agent/curveType.js` or
`agent/depthArithmetic.js` catches it live, at query time, computed from
the raw layer numbers.

| # | Internal inconsistency | Paper / page | Found by |
|---|---|---|---|
| 1 | Bori table swap: BMGS Bori Field / Kenpoly sec school field, p.7 Table 1 row labels swapped against the paper's own p.3 coordinate table | Menegbo et al. (2024), Bori | Context (Issues 1, 3, 8) |
| 2 | Choba Lawn Tennis Field labeled A-type despite its own stated non-monotonic trend (l1<l2>l3<l4<l5) | Oghonyon et al. (2025), Table 5 / Discussion | Context (Issue 2) + Code |
| 3 | Etche Odufor labeled A-type despite a non-monotonic layer sequence | Nwankwoala et al. (2022), Table 9 | Context (Issue 13) + Code |
| 4 | Etche Opiro labeled A-type despite a non-monotonic layer sequence | Nwankwoala et al. (2022), Table 9 | Code only, not a Context Issue |
| 5 | Etche Egwi, layer 4: printed depth and thickness don't reconcile (~7.0 m gap) | Nwankwoala et al. (2022), Table 1 | Code only, not a Context Issue |
| 6 | Etche Ulakwo, layers 2 and 3: printed depths don't reconcile (~1.3 m and ~11.0 m gaps) | Nwankwoala et al. (2022), Table 2 | Code only, not a Context Issue |
| 7 | Etche Okehi, layer 3: printed depth doesn't reconcile (~3.0 m gap) | Nwankwoala et al. (2022), Table 3 | Code only, not a Context Issue |
| 8 | Etche Akpoku, layer 2: printed depth doesn't reconcile (~0.8 m gap) | Nwankwoala et al. (2022), Table 6 | Code only, not a Context Issue (also initially missed by the code itself; see Limitations) |
| 9 | Etche Ndashi, layer 5: printed depth doesn't reconcile (~9.7 m gap) | Nwankwoala et al. (2022), Table 7 | Code only, not a Context Issue |
| 10 | Etche Umuokom, layer 5: printed depth doesn't reconcile (~9.4 m gap) | Nwankwoala et al. (2022), Table 8 | Code only, not a Context Issue |

**What this shows about Sanity Context's conflict detector, measured against this dataset:** of the 14 Issues it raised, 6 pointed to real errors; same-fact detection is what catches a case like the Bori swap, two structured entries stating different numbers for the same fact. Those 6 Issues cover 3 of the 10 internal inconsistencies that actually exist in the source papers (the Bori swap, the Choba mislabel, and, as of a later rebuild, the Etche Odufor mislabel). The other 7 (Etche Opiro's curve-type mislabel and all 6 Etche depth-arithmetic cases) were never raised as Context Issues; they need a derived computation from raw numbers instead (is this sequence monotonic? does this layer's depth equal the prior depth plus its own thickness?), which is outside what a same-fact conflict detector checks for, so this project's own code-side checks catch them at query time. Same-fact detection and derived computation are two different kinds of check, each catching a different kind of issue; this dataset needed both. Worth noting too: Context's precision on this dataset improved across rebuilds, from 4/11 (36%) to 6/14 (43%), not because the detector changed, but because later rebuilds happened to regenerate content in a shape that surfaced a real error (#13) it had missed before.

**Pattern worth noting for the post:** every rebuild that regenerates entries (Phase 8's purpose-text change included) has a real chance of introducing fresh transcription/attribution bugs into the newly generated prose, independent of whether the underlying source PDFs or dataset have any error. Issues 5, 6, 9, 10, 11, and 14 in Table A are all this same failure mode, not paper errors. The Knowledge Base's own Issue detector is what caught all of them before they reached the agent, which is itself a point in its favor even though none of them were real. Resolving one issue's standing instruction also visibly triggered a fresh rebuild that surfaced the next issue, three times in a row (#12, #13, #14) before a rebuild finally came back with 0 pending; each round was checked against the PDFs the same way as every issue before it, not assumed clean.
