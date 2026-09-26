# Demo: the Choba A-type curve mislabel

```bash
node agent/index.js "Is the Choba Lawn Tennis Field curve really an A-type curve like the paper says?"
```

Full raw output: [choba-demo-raw.txt](choba-demo-raw.txt)

## Tool calls made

1. **`initial_context`** on the Knowledge Base MCP endpoint.
2. **LLM call** (Qwen) picks entry paths:
   ```
   source_errors/curve_type_mislabeling, station_readings/choba, ves_interpretation/curve_types
   ```
3. **`data_initial_context`** on the GROQ MCP endpoint.
4. **LLM call** (Qwen) writes one GROQ query:
   ```groq
   *[_type == "vesReading" && site->name == "Lawn Tennis Field, University of Port Harcourt, Choba Town" && station == "Choba-LawnTennisField"] {
     _id, station, sourceLocation, curveTypePublished, rmsPercent, layers,
     reportedAquiferResistivityOhmM, reportedAquiferDepthM, reportedAquiferThicknessM,
     "siteName": site->name, "paperId": paper._ref, "paperTitle": paper->title,
     "paperCitation": paper->citation
   }
   ```
5. **Code-side check** (`curveTypeChecks`, `agent/curveType.js`): derives the curve type directly from the layer resistivities returned above -- `91.2 -> 380.2 -> 43.25 -> 474.3 -> 597.1` ohm-m -- and compares it against the paper's own `curveTypePublished: "A"`. This runs as a pure function on the retrieved numbers, not an LLM guess:
   ```
   [agent] curve type mismatch: Choba-LawnTennisField published=A derived=KHA
   ```
6. **`knowledge_base_read`**, batched, for the 3 paths selected in step 2.
7. **LLM call** (Qwen) synthesizes the final answer, told explicitly to treat the code-computed curve check as authoritative rather than re-deriving it itself.

## Answer

> **[ANOMALOUS]** No, it's not a true A-type curve because the resistivity drops sharply in the third layer instead of keeping steadily higher with depth.
>
> An A-type curve must show resistivity (a measure of how much the ground resists electric current, in ohm-meters) increasing at every step down — but here it jumps up, then crashes down, then climbs again. That dip breaks the strict rule for A-type.
>
> **SOURCE DISAGREEMENT FOUND**
> The paper labels the curve 'A-type' but its own layer data shows a non-monotonic sequence that contradicts that label.
> - Claim A: Oghonyon et al. (2025), Table 5 and throughout the text, labels the curve as A-type
> - Claim B: The same paper's Table 5 resistivity values (91.2 → 380.2 → 43.25 → 474.3 → 597.1 ohm-m) show a sharp drop at layer 3, making it non-A-type
> - Trusted: the paper's own resistivity values, which show layer 3 dropping to 43.25 ohm-m — the paper's Discussion section even explicitly describes the trend as l1 < l2 > l3 < l4 < l5, admitting the dip, so the data itself overrides the label.

Document ID cited: `reading-choba-choba-lawntennisfield`.

## Same station, offline mode

```bash
node agent/index.js --offline "Is the Choba Lawn Tennis Field curve really an A-type curve like the paper says?"
```

No LLM call, no Knowledge Base call, no network at all -- loads `agent/offline-snapshot.ndjson` and runs the identical GROQ query text via `groq-js` locally, then applies the same `checkLabel()` rule used online:

```
[LABEL MISMATCH] Choba-LawnTennisField
Published curve type "A" does not match the type derived from this reading's own layer values ("KHA").
```

Same conclusion, same underlying computation, zero network calls.
