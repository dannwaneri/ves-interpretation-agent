# VES Interpretation Agent

An agent that answers whether a hydrocarbon-seepage / groundwater resistivity reading is normal or anomalous for a specific Niger Delta survey site — grounded in real, published Vertical Electrical Sounding (VES) papers, queried through a [Sanity Context](https://www.sanity.io/docs/ai/sanity-context) Knowledge Base over MCP.

Built for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16).

**Sanity project ID:** `c78nb8ch` (dataset `production`)
**Knowledge Base ID:** `kbIp9dbX1pcY`

## The problem

The same resistivity reading means something different depending on the site's own history — a value that's normal at one location is a red flag at another. Field geologists checking this by hand have to cross-reference multiple published papers under time pressure, and those papers don't always agree with themselves.

## What makes this "only work because the content is structured"

Two real contradictions live in this Knowledge Base — not staged for the demo, both verified directly against the source PDFs:

1. **A same-paper table swap.** The Bori survey paper's own page-7 summary table prints two station names swapped against its own page-3 coordinate table and its own Figure 2 captions. A keyword search over the paper's text would return whichever row it happened to match — it has no way to know the row is mislabeled. Sanity Context's build step caught this as a same-fact conflict once the two readings were ingested as separate structured entries; resolving it created a persistent [Instruction](https://www.sanity.io/docs/ai/sanity-context-resolve-issues) that survives future rebuilds.
2. **A label that contradicts its own data.** Three stations across two independent papers (Choba's site, Etche's Odufor and Opiro) are labeled "A-type curve" in their source paper, but their own transcribed resistivity layers dip partway through — not monotonically increasing, which is what "A-type" actually requires. Catching this needs the raw numeric layer array, not the paper's prose label.

See `seed/verified-corrections.js` for exactly how these were verified against the real PDFs (with page/figure citations), not inferred.

## Project layout

```
studio/     Sanity Studio — schema for surveyPaper / surveySite / vesReading
seed/       Scripts that transcribe the real papers into structured Sanity documents
agent/      The querying agent (Node, MCP client + Gemini for reasoning)
```

## Reproducing this

1. **Studio + schema**: `cd studio && npm install && npm run dev` — schema lives in `studio/schemaTypes/`.
2. **Seed the dataset**:
   ```bash
   node seed/build-ndjson.js
   node seed/verified-corrections.js
   cd studio
   npx sanity dataset import ../seed.ndjson production
   npx sanity dataset import ../verified-corrections.ndjson production --replace
   ```
3. **Create the Knowledge Base** — this step is Sanity Dashboard-only (no CLI yet): `sanity.io/manage` → your org → **Context** → New knowledge base → add the `production` dataset as a source (with `surveyPaper`/`surveySite` reference unfolding enabled on `vesReading`) → Build entries → resolve any Issues it raises.
4. **Create an MCP endpoint** pointing at that Knowledge Base, and an org API token with **Context Viewer** permission (`Manage → API → Tokens`).
5. **Run the agent**:
   ```bash
   cp .env.example .env   # fill in your own token, KB id, MCP URL, Gemini key
   node agent/index.js "I got a 2950 ohm-m reading at BMGS Bori Field. Is that normal or anomalous, and can I trust it?"
   ```

## How the agent works

1. Calls the MCP endpoint's `initial_context` tool to get the Knowledge Base's outline (entry paths, summaries, relevance tags).
2. Uses an LLM to pick which entries are relevant to the question (never invents an answer from the outline alone).
3. Calls `knowledge_base_read` to fetch the full cited entries.
4. Synthesizes a verdict-first answer: plain-language call first, then the sources used, then the raw numbers as receipts — grounded only in what was retrieved. If two sources disagree, both values are stated explicitly with the reasoning for which is trusted, never silently collapsed to one.

## Data sources

Real, cited, DOI-linked VES survey papers:
- Menegbo, Davies & Horsfall (2024), Bori Metropolis — [doi.org/10.30574/wjarr.2024.24.2.3293](https://doi.org/10.30574/wjarr.2024.24.2.3293)
- Oghonyon, Nnurum & Oguejiofor (2025), Choba — [doi.org/10.51244/IJRSI.2025.120700155](https://doi.org/10.51244/IJRSI.2025.120700155)
- Nwankwoala, Osayande, Nwosu & Ugwu (2022), Etche LGA — [doi.org/10.30574/gjeta.2022.11.1.0070](https://doi.org/10.30574/gjeta.2022.11.1.0070)
