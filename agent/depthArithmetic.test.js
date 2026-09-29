const {test} = require('node:test')
const assert = require('node:assert/strict')
const {checkDepthArithmetic} = require('./depthArithmetic.js')

test('consistent depths match', () => {
  const reading = {
    station: 'Test',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 2, thicknessM: 2},
      {layerIndex: 2, cumulativeDepthM: 5, thicknessM: 3},
      {layerIndex: 3, cumulativeDepthM: 10, thicknessM: 5},
    ],
  }
  assert.equal(checkDepthArithmetic(reading).matches, true)
})

test('tiny floating point noise is tolerated', () => {
  const reading = {
    station: 'Test',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 2.535, thicknessM: 2.535},
      {layerIndex: 2, cumulativeDepthM: 18.37, thicknessM: 15.83}, // 2.535+15.83=18.365, diff 0.005
    ],
  }
  assert.equal(checkDepthArithmetic(reading).matches, true)
})

// Real values for Bori's Court-road, read live via groq_query on
// 2026-09-26. No documented depth-arithmetic issue for this station, but
// its printed depths have up to ~0.3 m of ordinary rounding drift -- this
// caught a too-tight tolerance (0.05 m) as a real bug before shipping.
test('Court-road (Bori): ordinary rounding noise must not be flagged', () => {
  const reading = {
    station: 'Court-road',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 2.56, thicknessM: 2.56},
      {layerIndex: 2, cumulativeDepthM: 12.9, thicknessM: 10.4}, // diff 0.06
      {layerIndex: 3, cumulativeDepthM: 62.9, thicknessM: 49.9}, // diff 0.10
      {layerIndex: 4, cumulativeDepthM: 114, thicknessM: 51.4}, // diff 0.30
    ],
  }
  assert.equal(checkDepthArithmetic(reading).matches, true)
})

// Real values for Egwi (Etche), read live via groq_query on 2026-09-26.
// Table 1 prints layer 4's cumulative depth as 37.25 m and thickness as
// 37.957 m; 6.2935 + 37.957 = 44.2505 m, not 37.25 m. The paper's own
// Figure 2 narrative text (eval/paper-text/etche.txt) independently repeats
// both the ~37.95 m thickness and the 37.25 m depth, so this is a real,
// repeated inconsistency in the published paper. It does NOT tell us which
// of the two printed numbers is wrong -- the check must report both
// possible readings, not pick one.
test('Egwi (Etche): layer 4 printed depth and thickness do not reconcile', () => {
  const reading = {
    station: 'Egwi',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.9, thicknessM: 0.9},
      {layerIndex: 2, cumulativeDepthM: 3.2, thicknessM: 2.3},
      {layerIndex: 3, cumulativeDepthM: 6.2935, thicknessM: 3.0935},
      {layerIndex: 4, cumulativeDepthM: 37.25, thicknessM: 37.957},
    ],
  }
  const result = checkDepthArithmetic(reading)
  assert.equal(result.matches, false)
  assert.equal(result.layerIndex, 4)
  assert.equal(result.printedCumulativeDepthM, 37.25)
  assert.equal(result.printedThicknessM, 37.957)
  assert.equal(result.impliedDepthIfThicknessCorrect, 44.2505)
  assert.equal(result.impliedThicknessIfDepthCorrect, 30.9565)
})

// The remaining 5 documented Etche depth-arithmetic errors, each read
// directly from eval/paper-text/etche.txt's own per-station tables on
// 2026-09-29 and independently confirmed by hand before being encoded here.
// Akpoku is the important one: its 0.795 m discrepancy is real (confirmed
// against the raw PDF) but is smaller than the original 1.0 m tolerance,
// which missed it entirely -- a genuine false negative found by checking
// every documented case against the source instead of assuming the two
// originally-tested examples (Egwi, Court-road) covered the real range.

test('Ulakwo (Etche): layer 2 does not reconcile', () => {
  const reading = {
    station: 'Ulakwo',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.12415, thicknessM: 0.124},
      {layerIndex: 2, cumulativeDepthM: 9.665, thicknessM: 8.25},
      {layerIndex: 3, cumulativeDepthM: 47.738, thicknessM: 27.074},
      {layerIndex: 4, cumulativeDepthM: null, thicknessM: null},
    ],
  }
  assert.equal(checkDepthArithmetic(reading).matches, false)
})

test('Okehi (Etche): layer 3 does not reconcile', () => {
  const reading = {
    station: 'Okehi',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.29506, thicknessM: 0.29506},
      {layerIndex: 2, cumulativeDepthM: 0.81449, thicknessM: 0.51943},
      {layerIndex: 3, cumulativeDepthM: 39.13, thicknessM: 35.32},
      {layerIndex: 4, cumulativeDepthM: null, thicknessM: null},
    ],
  }
  const result = checkDepthArithmetic(reading)
  assert.equal(result.matches, false)
  assert.equal(result.layerIndex, 3)
})

test('Akpoku (Etche): layer 2 does not reconcile, a smaller (~0.8 m) real error that a too-loose 1.0 m tolerance previously missed', () => {
  const reading = {
    station: 'Akpoku',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.36897, thicknessM: 0.36897},
      {layerIndex: 2, cumulativeDepthM: 0.45729, thicknessM: 0.8832},
      {layerIndex: 3, cumulativeDepthM: 4.1889, thicknessM: 3.7316},
      {layerIndex: 4, cumulativeDepthM: 33.027, thicknessM: 28.838},
      {layerIndex: 5, cumulativeDepthM: 81.135, thicknessM: 48.108},
    ],
  }
  const result = checkDepthArithmetic(reading)
  assert.equal(result.matches, false)
  assert.equal(result.layerIndex, 2)
})

test('Ndashi (Etche): layer 5 does not reconcile', () => {
  const reading = {
    station: 'Ndashi',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.49701, thicknessM: 0.49701},
      {layerIndex: 2, cumulativeDepthM: 2.0866, thicknessM: 1.5896},
      {layerIndex: 3, cumulativeDepthM: 6.6232, thicknessM: 4.5367},
      {layerIndex: 4, cumulativeDepthM: 24.217, thicknessM: 17.594},
      {layerIndex: 5, cumulativeDepthM: 30.85, thicknessM: 16.33},
    ],
  }
  const result = checkDepthArithmetic(reading)
  assert.equal(result.matches, false)
  assert.equal(result.layerIndex, 5)
})

test('Umuokom (Etche): layer 5 does not reconcile', () => {
  const reading = {
    station: 'Umuokom',
    layers: [
      {layerIndex: 1, cumulativeDepthM: 0.60549, thicknessM: 0.60549},
      {layerIndex: 2, cumulativeDepthM: 0.93718, thicknessM: 0.33169},
      {layerIndex: 3, cumulativeDepthM: 5.2477, thicknessM: 4.3105},
      {layerIndex: 4, cumulativeDepthM: 35.724, thicknessM: 30.476},
      {layerIndex: 5, cumulativeDepthM: 36.766, thicknessM: 10.418},
    ],
  }
  const result = checkDepthArithmetic(reading)
  assert.equal(result.matches, false)
  assert.equal(result.layerIndex, 5)
})
