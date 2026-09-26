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
