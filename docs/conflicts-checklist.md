# Conflicts checklist (Phase 6)

All 7 conflicts Sanity Context found and resolved while building the VES
Interpretation Knowledge Base, pulled from Context → VES Interpretation KB →
Issues → Resolved (7), on 2026-09-26. Each one below needs a human check
against the actual source PDFs: mark it **REAL** (a genuine error in the
published paper) or **ARTIFACT** (Context flagged something that isn't
actually a problem, e.g. two entries describing the same fact in different
words).

- [ ] Real / Artifact
- [ ] Real / Artifact
- [ ] Real / Artifact
- [ ] Real / Artifact
- [ ] Real / Artifact
- [ ] Real / Artifact
- [ ] Real / Artifact

---

## 1. BMGS Bori Field resistivity swap (via Cross-Site Aquifer Benchmarks)

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry reports BMGS-bori-field aquifer resistivity as 2950 Ω·m, but the Cross-Site Aquifer Resistivity Benchmarks entry cites 2950 Ω·m while also noting that the Bori paper's summary table contains swapped station-name labels, with the row labeled 'BMGS bori field' actually carrying Kenpoly data (3706 Ω·m).

- One entry says: **2950 Ω·m** (BMGS Bori Field)
- Another entry says: **3706 Ω·m** (mislabeled as BMGS, actually Kenpoly)

**Source / page:** Menegbo et al. (2024), Bori Metropolis paper. 2950 Ω·m comes from Figure 2 panel caption + p.3 coordinate table; 3706 Ω·m comes from p.7 Table 1 (summary table), row printed "BMGS bori field".

**Resolution:** Saved as an instruction shaping future rebuilds.

---

## 2. Choba Lawn Tennis Field curve-type mislabel

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Choba entry states that the Lawn Tennis Field station is labeled A-type in the paper, but the Curve-Type Classification Errors entry and the Curve-Type Definitions entry both identify this as a mislabeled non-monotonic sequence that should not be classified as A-type.

- One entry says: **A-type** (as published)
- Another entry says: **unclassified** (non-monotonic, not A-type)

**Source / page:** Oghonyon et al. (2025), Table 5 (values) and Discussion/Conclusion sections (aquifer designation, curve label). Layer resistivities: 91.2 → 380.2 → 43.25 → 474.3 → 597.1 Ω·m -- confirmed non-monotonic (a dip at layer 3) by `agent/curveType.js`'s `deriveCurveType()`, which derives "KHA", not "A".

**Resolution:** Saved as an instruction shaping future rebuilds.

---

## 3. BMGS Bori Field resistivity swap (via aquifer_benchmarks + source_errors)

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry lists BMGS-Bori-Field with an aquifer resistivity of 2950 Ω·m, but the aquifer_benchmarks entry and source_errors/data_inconsistencies entry indicate that the station labeled "BMGS bori field" in the paper's summary table actually has an aquifer resistivity of 2950 Ω·m according to Figure 2 panel (c), while the row labeled "BMGS bori field" in Table 1 carries data for Kenpoly (3706 Ω·m).

- One entry says: **2950 Ω·m** (BMGS-Bori-Field)
- Another entry says: **2950 Ω·m** (mislabeled as Kenpoly in Table 1)

**Source / page:** Same underlying fact as #1, detected as a separate Issue because a third entry (`aquifer_benchmarks`, `source_errors/data_inconsistencies`) also states it. Same source: p.7 Table 1 vs Figure 2 panel (c) / p.3 coordinate table.

**Resolution:** Saved as an instruction shaping future rebuilds.

**Note:** #1 and #3 both describe the same real-world BMGS/Kenpoly swap -- Context raised it twice because three or more entries independently state the fact and it compares pairwise. When verifying against the PDF, one check covers both.

---

## 4. Kenpoly Convocation Arena vs. Kenpoly sec school field -- ⚠ check this one carefully

**Scope:** Whole knowledge base | **Kind:** Conflict | **Severity:** Critical

> The Bori High-Resistivity Aquifer Stations entry lists Kenpoly-convocation-arena with an aquifer resistivity of 3488 Ω·m, but the Bori Low-to-Moderate Resistivity Stations entry and the source-errors/data_inconsistencies entry indicate that the station labeled "Kenpoly sec school field" in the paper's summary table actually has an aquifer resistivity of 3706 Ω·m (from the paper's Figure 2 and coordinate table).

- One entry says: **3488 Ω·m**
- Another entry says: **3706 Ω·m**

**Source / page:** Kenpoly-convocation-arena's own reading: 3488 Ω·m, Figure 2 panel caption. Kenpoly-sec-school-field's true value: 3706 Ω·m, its own Figure 2 panel caption.

**⚠ Why this needs extra scrutiny:** "Kenpoly Convocation Arena" and "Kenpoly sec school field" are two genuinely **different, real stations** in the Bori dataset, each with its own uncontested reading (3488 and 3706 respectively) -- see `eval/questions.json`'s `bori-kenpoly-convocation-control` question, which the agent answers as a clean, no-conflict station. This Issue's own phrasing juxtaposes them as if they were competing claims about the same fact, purely because both station names contain "Kenpoly." That is exactly the same category of name-similarity confusion documented in `examples/bori-demo.md` and the Phase 4 commit history (the agent itself fabricated a conflict this way for Kenpoly Convocation Arena before being fixed). Worth checking whether this Issue is describing a real paper error, or whether it's Context (or the resolution) conflating two distinct stations the way the agent once did.

**Resolution:** Saved as an instruction shaping future rebuilds.

---

## 5. Kor-road layer model duplicated into Kenpoly Convocation Arena's section

**Scope:** Bori High-Resistivity Aquifer Stations entry | **Kind:** Conflict | **Severity:** Critical

> The full layer model section for Kor-road is correct, but it is duplicated identically for Kenpoly-convocation-arena, which should show a 5-layer model with aquifer at layer 4 (3488 Ω·m). The two stations have been conflated in the full layer models section.

**What the entry said (Kor-road section):** Layer 1: 1.24 m @ 1916 Ω·m | Layer 2: 1.79 m @ 1252 Ω·m | Layer 3 (aquifer): 108 m @ 1658 Ω·m | Layer 4: 581 Ω·m (basement) -- correct.

**What the source says (`reading-bori-kor-road`):** Same model, confirmed correct.

**Note:** This one is about the *KB entry's own generated text*, not a paper-transcription error -- Kor-road's numbers got copy-pasted under Kenpoly-convocation-arena's heading during entry generation. See #6, the same bug described from the other side.

**Resolution:** The entry is being updated, saved as an instruction for future rebuilds.

---

## 6. Kenpoly Convocation Arena's layer model didn't match its own source

**Scope:** Bori High-Resistivity Aquifer Stations entry | **Kind:** Conflict | **Severity:** Critical

> The layer model listed for Kenpoly-convocation-arena in the entry does not match the source. The source shows layer 4 as the aquifer at 3488 Ω·m, not layer 3 at 1658 Ω·m. The listed model appears to belong to Kor-road instead.

**What the entry said (Kenpoly-convocation-arena section, before fix):** Layer 1: 1.24 m @ 1916 Ω·m | Layer 2: 1.79 m @ 1252 Ω·m | Layer 3 (aquifer): 108 m @ 1658 Ω·m | Layer 4+: 581 Ω·m -- this is Kor-road's model, wrongly filed under Kenpoly.

**What the source says (`reading-bori-kenpoly-convocation-arena`):** Layer 1: 2.5 m @ 1434 Ω·m | Layer 2: 5.42 m @ 1879 Ω·m | Layer 3: 18 m @ 318 Ω·m | Layer 4 (aquifer): 24.3 m @ 3488 Ω·m | Layer 5 (basement): 542 Ω·m. Reported aquifer resistivity 3488 Ω·m at 50.2 m depth.

**Note:** Same underlying bug as #5, the KB entry's own generated content, not a paper error.

**Resolution:** The entry is being updated, saved as an instruction for future rebuilds.

---

## 7. Eight Etche stations claim -- confirmed accurate, not a real conflict

**Scope:** Cross-Site Aquifer Resistivity Benchmarks entry | **Kind:** Conflict | **Severity:** (not critical)

> The body's claim of eight Etche stations is actually correct and matches the source, so there is no conflict here. This appears to be accurate.

**What the entry says:** Etche (2022): Eight survey stations (Opiro, Odufor, Ndashi, Umuokom, Egwi, Ulakwo, Okehi, Akpoku) with layer-by-layer resistivity, depth, and thickness data from Tables 1-8.

**What the source says:** Confirms all 8 station names match: Opiro, Odufor, Egwi, Ulakwo, Okehi, Akpoku, Ndashi, Umuokom.

**Source / page:** Nwankwoala et al. (2022), Etche LGA paper, Tables 1-8.

**Note:** This is Context's own false-positive, flagged then confirmed accurate on review. No paper error to verify here -- just confirm the 8 names against the paper's own station list if you want a final sanity check.

---

## Summary for quick reference

| # | Station(s) | What's in question | Category |
|---|---|---|---|
| 1, 3 | BMGS Bori Field / Kenpoly sec school field | 2950 vs 3706 Ω·m table swap | Real (paper transcription error) |
| 2 | Choba Lawn Tennis Field | A-type label vs non-monotonic data | Real (paper labeling error) |
| 4 | Kenpoly Convocation Arena vs Kenpoly sec school field | ⚠ possibly a false pairing of two different stations | Needs your review |
| 5, 6 | Kor-road / Kenpoly Convocation Arena | KB entry's own generated text had a copy-paste error | KB-build bug, not a paper error |
| 7 | Etche (8 stations) | False positive, already confirmed accurate | Not a real conflict |
