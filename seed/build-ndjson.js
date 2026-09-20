const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, 'data')
const bori = JSON.parse(fs.readFileSync(path.join(dataDir, 'bori_ves_stations.json'), 'utf8'))
const choba = JSON.parse(fs.readFileSync(path.join(dataDir, 'choba_ves_stations.json'), 'utf8'))
const etche = JSON.parse(fs.readFileSync(path.join(dataDir, 'etche_ves_stations.json'), 'utf8'))

const docs = []

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function centroid(stations) {
  const lat = stations.reduce((a, s) => a + s.latitude, 0) / stations.length
  const lng = stations.reduce((a, s) => a + s.longitude, 0) / stations.length
  return {lat, lng}
}

function layersFromArrays(resistivities, thicknesses, depths) {
  return resistivities.map((r, i) => ({
    _key: `l${i}`,
    _type: 'layer',
    layerIndex: i + 1,
    resistivityOhmM: r,
    thicknessM: thicknesses[i] ?? null,
    cumulativeDepthM: depths[i] ?? null,
  }))
}

// ---- Bori paper ----
docs.push({
  _id: 'paper-bori-2024',
  _type: 'surveyPaper',
  title:
    'Assessment of Aquifer Resistivity, Depth, and Thickness using Vertical Electrical Sounding (VES) in Parts of Bori Metropolis for Groundwater Exploration',
  authors: ['Menegbo, B.G.', 'Davies, O.A.', 'Horsfall, O.I.'],
  journal: 'World Journal of Advanced Research and Reviews',
  year: 2024,
  citation: bori.source.citation,
  doi: bori.source.doi,
  license: 'cc-by-4.0',
  sourceNotes: `${bori.source.note}\n\nKnown source inconsistency: ${bori.source.known_source_inconsistency}`,
})

const boriCentroid = centroid(bori.stations)
docs.push({
  _id: 'site-bori',
  _type: 'surveySite',
  name: 'Bori Metropolis',
  lga: 'Khana',
  state: 'Rivers State',
  location: {_type: 'geopoint', lat: boriCentroid.lat, lng: boriCentroid.lng},
  paper: {_type: 'reference', _ref: 'paper-bori-2024'},
})

for (const st of bori.stations) {
  docs.push({
    _id: `reading-bori-${slug(st.station_id)}`,
    _type: 'vesReading',
    station: st.station_id,
    site: {_type: 'reference', _ref: 'site-bori'},
    paper: {_type: 'reference', _ref: 'paper-bori-2024'},
    sourceLocation: 'Figure 2 panel caption (IPI2Win-inverted layer table)',
    rmsPercent: st.rms_percent,
    layers: layersFromArrays(st.resistivities_ohm_m, st.thicknesses_m, st.depths_m),
    reportedAquiferResistivityOhmM: st.reported_aquifer_resistivity_ohm_m,
    reportedAquiferDepthM: st.reported_aquifer_depth_m,
    reportedAquiferThicknessM: st.reported_aquifer_thickness_m,
    transcriptionNote: st.note || undefined,
  })
}

// ---- Choba paper ----
docs.push({
  _id: 'paper-choba-2025',
  _type: 'surveyPaper',
  title:
    'Evaluation of Resistivity Data for Delineating Potential Potable Water Accumulation Zone at Choba, Rivers State Nigeria',
  authors: ['Oghonyon, R.', 'Nnurum, E.U.', 'Oguejiofor, C.V.'],
  journal: 'International Journal of Research and Scientific Innovation (IJRSI)',
  year: 2025,
  citation: choba.source.citation,
  doi: choba.source.doi,
  license: 'unmarked',
  sourceNotes: `${choba.source.note}\n\nCurve-type note: ${choba.source.curve_type_note}`,
})

docs.push({
  _id: 'site-choba',
  _type: 'surveySite',
  name: 'Lawn Tennis Field, University of Port Harcourt, Choba Town',
  lga: 'Obio/Akpor',
  state: 'Rivers State',
  paper: {_type: 'reference', _ref: 'paper-choba-2025'},
})

for (const st of choba.stations) {
  docs.push({
    _id: `reading-choba-${slug(st.station_id)}`,
    _type: 'vesReading',
    station: st.station_id,
    site: {_type: 'reference', _ref: 'site-choba'},
    paper: {_type: 'reference', _ref: 'paper-choba-2025'},
    sourceLocation: 'Table 5',
    aquiferLithology: st.aquifer_lithology,
    curveTypePublished: st.curve_type_published,
    layers: layersFromArrays(st.resistivities_ohm_m, st.thicknesses_m, st.depths_m),
    reportedAquiferResistivityOhmM: st.resistivities_ohm_m[st.resistivities_ohm_m.length - 1],
    reportedAquiferDepthM: st.depths_m[st.depths_m.length - 1],
    reportedAquiferThicknessM: st.thicknesses_m[st.thicknesses_m.length - 1],
    transcriptionNote:
      "Paper labels this an 'A-type' curve, but the layer sequence (91.2 -> 380.2 -> 43.25 -> 474.3 -> 597.1 ohm-m) dips at layer 3, not monotonically increasing. The paper's own Discussion text even states the trend as l1<l2>l3<l4<l5, contradicting its own 'A-type' label.",
  })
}

// ---- Etche paper ----
docs.push({
  _id: 'paper-etche-2022',
  _type: 'surveyPaper',
  title: 'Groundwater exploration using vertical electrical sounding techniques in parts of Etche Local Government Area of Rivers State, Nigeria',
  authors: ['Nwankwoala, H.O.', 'Osayande, A.D.', 'Nwosu, C.H.', 'Ugwu, S.A.'],
  journal: 'Global Journal of Engineering and Technology Advances',
  year: 2022,
  citation: etche.source.citation,
  doi: etche.source.doi,
  license: 'cc-by-4.0',
  sourceNotes: `${etche.source.note}\n\nKnown source inconsistency: ${etche.source.known_source_inconsistency}`,
})

docs.push({
  _id: 'site-etche',
  _type: 'surveySite',
  name: 'Etche LGA survey stations',
  lga: 'Etche',
  state: 'Rivers State',
  paper: {_type: 'reference', _ref: 'paper-etche-2022'},
})

const nonMonotonicNote = {
  Odufor:
    "Paper labels this an 'A-type' curve, but the sequence (20.320 -> 851.16 -> 2511.9 -> 1345.0 ohm-m) dips at layer 4, not monotonically increasing.",
  Opiro:
    "Paper labels this an 'A-type' curve, but the sequence (54.639 -> 9147.8 -> 1119.9 -> 2566.8 ohm-m) dips at layer 3, not monotonically increasing.",
}

for (const st of etche.stations) {
  docs.push({
    _id: `reading-etche-${slug(st.station_id)}`,
    _type: 'vesReading',
    station: st.station_id,
    site: {_type: 'reference', _ref: 'site-etche'},
    paper: {_type: 'reference', _ref: 'paper-etche-2022'},
    sourceLocation: `Tables 1-8 (station), Table 9 (curve type)`,
    aquiferLithology: st.aquifer_lithology,
    curveTypePublished: st.curve_type,
    layers: layersFromArrays(st.resistivities_ohm_m, st.thicknesses_m, st.depths_m),
    reportedAquiferResistivityOhmM: st.resistivities_ohm_m[st.resistivities_ohm_m.length - 1],
    reportedAquiferDepthM: st.depths_m[st.depths_m.length - 1],
    reportedAquiferThicknessM: st.thicknesses_m[st.thicknesses_m.length - 1],
    transcriptionNote: nonMonotonicNote[st.station_id],
  })
}

const ndjson = docs.map((d) => JSON.stringify(d)).join('\n')
fs.writeFileSync(path.join(__dirname, '..', 'seed.ndjson'), ndjson)
console.log(`Wrote ${docs.length} documents to seed.ndjson`)
