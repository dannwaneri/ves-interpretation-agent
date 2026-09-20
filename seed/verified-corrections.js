// Corrections applied after cross-checking the seeded data against the real source PDFs
// (wjarr.com/sites/default/files/fulltext_pdf/WJARR-2024-3293.pdf and
// rsisinternational.org .../1525-1532.pdf). Run after build-ndjson.js.
//
// Two real, verified-not-fabricated contradictions from this correction pass:
// 1. Bori paper's own p.7 summary table swaps two station-name labels against its own
//    p.3 coordinate table and its own Figure 2 captions. Both readings are kept as
//    separate documents, tagged by which part of the paper they came from.
// 2. Choba's paper states two different "the aquifer" answers in its own Discussion:
//    layer 5 (597.1 ohm-m) is its highest-resistivity headline number, but its actual
//    borehole-siting recommendation is layer 4 (474.3 ohm-m), because layer 5 is
//    discontinuous. Both values are preserved; the recommendation is treated as the
//    reported aquifer resistivity, since that's the paper's own actionable conclusion.

const fs = require('fs')
const path = require('path')

const docs = [
  {
    _id: 'paper-bori-2024',
    _type: 'surveyPaper',
    title:
      'Assessment of Aquifer Resistivity, Depth, and Thickness using Vertical Electrical Sounding (VES) in Parts of Bori Metropolis for Groundwater Exploration',
    authors: ['Menegbo, B.G.', 'Davies, O.A.', 'Horsfall, O.I.'],
    journal: 'World Journal of Advanced Research and Reviews',
    year: 2024,
    citation:
      'Menegbo, B.G., Davies, O.A., Horsfall, O.I. (2024). Assessment of Aquifer Resistivity, Depth, and Thickness using Vertical Electrical Sounding (VES) in Parts of Bori Metropolis for Groundwater Exploration. World Journal of Advanced Research and Reviews, 24(02), 275-285.',
    doi: 'https://doi.org/10.30574/wjarr.2024.24.2.3293',
    license: 'cc-by-4.0',
    sourceNotes:
      "Verified directly against the source PDF (wjarr.com/sites/default/files/fulltext_pdf/WJARR-2024-3293.pdf). The paper's own p.7 Table 1 (summary table) prints swapped station-name labels for two rows: the row labeled 'BMGS bori field' actually carries Kenpoly sec school field's coordinates and Figure-2-panel-(b) values (3706 ohm-m), while the row labeled 'Kenpoly sec school field' carries BMGS bori field's coordinates and Figure-2-panel-(c) values (2950 ohm-m). This is checkable against the paper's own p.3 coordinate table and its own Figure 2 captions, which agree with each other and disagree with the p.7 table's row labels. Both versions are recorded in this Knowledge Base as separate readings per station, tagged by which part of the paper they came from.",
  },
  {
    _id: 'reading-bori-kenpoly-sec-school-field-p7table',
    _type: 'vesReading',
    station: 'Kenpoly-sec-school-field',
    site: {_type: 'reference', _ref: 'site-bori'},
    paper: {_type: 'reference', _ref: 'paper-bori-2024'},
    sourceLocation: "p.7 Table 1 (summary table), row printed 'Kenpoly sec school field'",
    layers: [
      {_key: 'l0', _type: 'layer', layerIndex: 1, resistivityOhmM: 1005, thicknessM: 3.42, cumulativeDepthM: 3.42},
      {_key: 'l1', _type: 'layer', layerIndex: 2, resistivityOhmM: 3588, thicknessM: 6.33, cumulativeDepthM: 9.76},
      {_key: 'l2', _type: 'layer', layerIndex: 3, resistivityOhmM: 1358, thicknessM: 10.9, cumulativeDepthM: 20.7},
      {_key: 'l3', _type: 'layer', layerIndex: 4, resistivityOhmM: 333, thicknessM: 9.08, cumulativeDepthM: 29.7},
      {_key: 'l4', _type: 'layer', layerIndex: 5, resistivityOhmM: 2950, thicknessM: 36.8, cumulativeDepthM: 66.5},
      {_key: 'l5', _type: 'layer', layerIndex: 6, resistivityOhmM: 5469, thicknessM: null, cumulativeDepthM: null},
    ],
    reportedAquiferResistivityOhmM: 2950,
    reportedAquiferDepthM: 66.5,
    reportedAquiferThicknessM: 36.2,
    transcriptionNote:
      "This row's printed coordinates (7.36096, 4.67842) match BMGS bori field's coordinates in the paper's own p.3 Table 1, not Kenpoly sec school field's. Its resistivity/depth/thickness values also match Figure 2 panel (c), which the paper's own figure caption labels 'BMGS bori field', not Kenpoly sec school field. Verified directly against the PDF, not inferred.",
  },
  {
    _id: 'reading-bori-bmgs-bori-field-p7table',
    _type: 'vesReading',
    station: 'BMGS-bori-field',
    site: {_type: 'reference', _ref: 'site-bori'},
    paper: {_type: 'reference', _ref: 'paper-bori-2024'},
    sourceLocation: "p.7 Table 1 (summary table), row printed 'BMGS bori field'",
    layers: [
      {_key: 'l0', _type: 'layer', layerIndex: 1, resistivityOhmM: 1874, thicknessM: 2.78, cumulativeDepthM: 2.78},
      {_key: 'l1', _type: 'layer', layerIndex: 2, resistivityOhmM: 2428, thicknessM: 9.13, cumulativeDepthM: 11.9},
      {_key: 'l2', _type: 'layer', layerIndex: 3, resistivityOhmM: 1071, thicknessM: 15.2, cumulativeDepthM: 27.1},
      {_key: 'l3', _type: 'layer', layerIndex: 4, resistivityOhmM: 3706, thicknessM: 32.2, cumulativeDepthM: 59.3},
      {_key: 'l4', _type: 'layer', layerIndex: 5, resistivityOhmM: 178, thicknessM: null, cumulativeDepthM: null},
    ],
    reportedAquiferResistivityOhmM: 3706,
    reportedAquiferDepthM: 59.3,
    reportedAquiferThicknessM: 32.2,
    transcriptionNote:
      "This row's printed coordinates (7.37207889, 4.665453) match Kenpoly sec school field's coordinates in the paper's own p.3 Table 1, not BMGS bori field's. Its values also match Figure 2 panel (b), captioned 'Kenpoly sec school field' by the paper itself. Verified directly against the PDF.",
  },
  {
    _id: 'reading-choba-choba-lawntennisfield',
    _type: 'vesReading',
    station: 'Choba-LawnTennisField',
    site: {_type: 'reference', _ref: 'site-choba'},
    paper: {_type: 'reference', _ref: 'paper-choba-2025'},
    sourceLocation: 'Table 5 (values), Discussion and Conclusion sections (aquifer designation)',
    aquiferLithology: 'gravel (layer 4, 474.3 ohm-m) / conglomerate (layer 5, 597.1 ohm-m, discontinuous)',
    curveTypePublished: 'A',
    layers: [
      {_key: 'l0', _type: 'layer', layerIndex: 1, resistivityOhmM: 91.2, thicknessM: 2.535, cumulativeDepthM: 2.535},
      {_key: 'l1', _type: 'layer', layerIndex: 2, resistivityOhmM: 380.2, thicknessM: 15.83, cumulativeDepthM: 18.37},
      {_key: 'l2', _type: 'layer', layerIndex: 3, resistivityOhmM: 43.25, thicknessM: 20.36, cumulativeDepthM: 38.73},
      {_key: 'l3', _type: 'layer', layerIndex: 4, resistivityOhmM: 474.3, thicknessM: 33.05, cumulativeDepthM: 71.78},
      {_key: 'l4', _type: 'layer', layerIndex: 5, resistivityOhmM: 597.1, thicknessM: null, cumulativeDepthM: null},
    ],
    reportedAquiferResistivityOhmM: 474.3,
    reportedAquiferDepthM: 71.78,
    reportedAquiferThicknessM: 33.05,
    transcriptionNote:
      "Verified against the source PDF. The paper genuinely holds two different answers for 'the aquifer' here, not one: layer 5 (597.1 ohm-m, ~90m estimated depth) is called its highest-resistivity 'potential quality aquifer zone' in the Discussion, but the same Discussion section's actual actionable recommendation is 'advisable to cite a borehole at layer 4 (474.3ohm-m)' -- specifically because layer 5 is discontinuous (not reliably present across the site) while layer 4 is not. This reading uses layer 4 as reportedAquiferResistivityOhmM because that is the paper's own siting recommendation, but layer 5's value is preserved in the layers array and should not be discarded -- both are real signals from the same paper for different reasons.\n\nSeparately, curve-type note: the paper's own Discussion states the resistivity trend as l1<l2>l3<l4<l5 (a real dip at layer 3, non-monotonic), yet the same Discussion explicitly calls it an 'A-type curve pattern, defined by progressive increase in resistivity with depth' -- the paper's own label contradicts its own stated trend.",
  },
]

fs.writeFileSync(path.join(__dirname, '..', 'verified-corrections.ndjson'), docs.map((d) => JSON.stringify(d)).join('\n'))
console.log(`Wrote ${docs.length} corrected documents to verified-corrections.ndjson`)
