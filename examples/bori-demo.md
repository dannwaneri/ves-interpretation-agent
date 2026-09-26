# Demo: the Bori page-7 table swap

```bash
node agent/index.js "I got a 2950 ohm-m reading at BMGS Bori Field. Is that normal or anomalous, and can I trust it?"
```

Full raw output: [bori-demo-raw.txt](bori-demo-raw.txt)

## Tool calls made

1. **`initial_context`** on the Knowledge Base MCP endpoint: gets the outline of every entry, used to pick which ones are relevant.
2. **LLM call** (Qwen) picks entry paths from that outline:
   ```
   station_readings/bori/high_resistivity_stations, aquifer_benchmarks,
   source_errors/data_inconsistencies, source_errors/curve_type_mislabeling,
   survey_site_metadata, ves_interpretation/curve_types
   ```
3. **`data_initial_context`** on the GROQ MCP endpoint: gets the live schema.
4. **LLM call** (Qwen) writes one GROQ query against the real dataset:
   ```groq
   *[_type == "vesReading" && site->name == "Bori Metropolis" && station == "BMGS-bori-field"]{
     _id, station, sourceLocation, curveTypePublished, rmsPercent, layers,
     reportedAquiferResistivityOhmM, reportedAquiferDepthM, reportedAquiferThicknessM,
     "siteName": site->name, "paperId": paper._ref, "paperTitle": paper->title,
     "paperCitation": paper->citation
   }
   ```
   This returns **two** documents for the same station: `reading-bori-bmgs-bori-field` (2950 ohm-m, from the figure caption) and `reading-bori-bmgs-bori-field-p7table` (3706 ohm-m, from the page-7 summary table). That's the swap, read directly off the live dataset, not staged for the demo.
5. **`knowledge_base_read`** on the KB endpoint, batched, for the 6 paths selected in step 2.
6. **LLM call** (Qwen) synthesizes the final answer from the GROQ data + the Knowledge Base prose.
7. **Code-side check** (`enforceGrounding`, `agent/grounding.js`): scans the synthesized answer's numbers and conflict claims against the actual GROQ data, and would drop the conflict block if it cited a number not present in the retrieved rows. Nothing was dropped here: both claimed values (2950 and 3706) are real values from the two retrieved documents.

## Answer

> **[NORMAL]** Yes, 2950 ohm-m is normal for BMGS Bori Field — it matches the trusted figure caption and fits the pattern of high-resistivity aquifers in Bori.
>
> Resistivity (measured in ohm-meters) tells us how strongly a layer resists electrical current — higher numbers often mean cleaner, sandier groundwater layers. In Bori Metropolis, nearly all surveyed sites have aquifer resistivities well above 1000 ohm-m, and 2950 ohm-m falls right in line with that expected range.
>
> **SOURCE DISAGREEMENT FOUND**
> Two different values are reported for the same station: 2950 ohm-m from the figure caption and 3706 ohm-m from the summary table.
> - Claim A: Figure 2 panel caption (IPI2Win-inverted layer table) says 2950 ohm-m
> - Claim B: p.7 Table 1 (summary table), row printed 'BMGS bori field' says 3706 ohm-m
> - Trusted: the figure caption and coordinate table, which say 2950 ohm-m — the paper's own coordinate table (p.3) and figure captions agree with each other and contradict the summary table labels, and the Knowledge Base confirms the table rows are swapped, so the 3706 value actually belongs to Kenpoly sec school field, not BMGS Bori Field.

Document IDs cited: `reading-bori-bmgs-bori-field`, `reading-bori-bmgs-bori-field-p7table`.

## A note on one line in this answer

The line *"nearly all surveyed sites have aquifer resistivities well above 1000 ohm-m"* traces back to a real Knowledge Base entry (`station_readings/bori/high_resistivity_stations`), but that entry is a curated subset of 8 of Bori's 13 stations, the ones that exceed 1000 ohm-m, and its own prose doesn't disclose that it's partial ("Eight VES surveys at Bori Metropolis stations... all show..."). Five other Bori stations are well below 1000 ohm-m (as low as 149). This is a content-scoping issue in that Knowledge Base entry itself, not a fabrication by the agent. Flagged here for Phase 6/8 review rather than silently shipped unremarked.

## Same station, `--public` mode, and a bug this caught

```bash
node agent/index.js --public "I got a 2950 ohm-m reading at BMGS Bori Field. Is that normal or anomalous, and can I trust it?"
```

`--public` uses no Sanity token (works once the dataset's visibility is set to public) but still calls the LLM, with no Knowledge Base access. The first time this was tested end to end, it got the swap **backwards**: verdict `ANOMALOUS`, claiming *"2950 ohm-m actually belongs to Kenpoly sec school field, not BMGS"*, the exact opposite of the correct resolution. Without the Knowledge Base's narrative to lean on, the model was asked to disambiguate two same-station documents from `sourceLocation` text alone, and got it wrong 3/3 times, even after adding an explicit prompt rule.

The fix followed the same pattern as the curve-type check: `agent/tableSwap.js` computes which of the two documents is trustworthy in code (the one whose `sourceLocation` isn't a summary-table row), and `agent/public.js`'s `applyTableSwapOverride()` rewrites the verdict and conflict block afterward rather than trusting the model's prose reasoning for a mechanically knowable fact. Re-verified 3/3 correct after the fix:

```
[NORMAL] The 2950 ohm-m reading at BMGS Bori Field is normal and trustworthy, as it
matches the primary figure-based source and is explicitly designated as the trusted value.
```
