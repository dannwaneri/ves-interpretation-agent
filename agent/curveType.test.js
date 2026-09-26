const {test} = require('node:test')
const assert = require('node:assert/strict')
const {deriveCurveType, checkLabel} = require('./curveType.js')

function layer(resistivityOhmM, layerIndex) {
  return {layerIndex, resistivityOhmM}
}

test('A-type: strictly increasing resistivity', () => {
  const layers = [layer(1, 1), layer(2, 2), layer(3, 3)]
  assert.equal(deriveCurveType(layers), 'A')
})

test('Q-type: strictly decreasing resistivity', () => {
  const layers = [layer(3, 1), layer(2, 2), layer(1, 3)]
  assert.equal(deriveCurveType(layers), 'Q')
})

test('H-type: dips then rises', () => {
  const layers = [layer(5, 1), layer(2, 2), layer(4, 3)]
  assert.equal(deriveCurveType(layers), 'H')
})

test('K-type: rises then dips', () => {
  const layers = [layer(2, 1), layer(5, 2), layer(3, 3)]
  assert.equal(deriveCurveType(layers), 'K')
})

test('four-layer curve returns two letters (HA)', () => {
  const layers = [layer(5, 1), layer(2, 2), layer(4, 3), layer(6, 4)]
  assert.equal(deriveCurveType(layers), 'HA')
})

test('equal adjacent values are undecidable and return "?"', () => {
  const layers = [layer(3, 1), layer(3, 2), layer(5, 3)]
  assert.equal(deriveCurveType(layers), '?')
})

test('fewer than 3 layers throws instead of guessing', () => {
  assert.throws(() => deriveCurveType([layer(1, 1), layer(2, 2)]))
})

// Real layer values read from the dataset via groq_query on 2026-09-26
// (query: *[_type=="vesReading" && station in ["Odufor","Opiro",
// "Choba-LawnTennisField"]]{_id,station,curveTypePublished,layers}).
// All three are published as "A-type" in their source papers. The point
// of this classifier is that the papers' own numbers say otherwise.

test('Choba Lawn Tennis Field: published A, but the numbers say otherwise', () => {
  const reading = {
    station: 'Choba-LawnTennisField',
    curveTypePublished: 'A',
    layers: [
      {layerIndex: 1, resistivityOhmM: 91.2},
      {layerIndex: 2, resistivityOhmM: 380.2},
      {layerIndex: 3, resistivityOhmM: 43.25},
      {layerIndex: 4, resistivityOhmM: 474.3},
      {layerIndex: 5, resistivityOhmM: 597.1},
    ],
  }
  const {derived, matches} = checkLabel(reading)
  assert.equal(derived, 'KHA')
  assert.equal(matches, false)
})

// Real layer values for Egwi (Etche) read live via groq_query on
// 2026-09-26 (*[_type=="vesReading" && station=="Egwi"]{station,
// curveTypePublished,"r":layers[].resistivityOhmM}). Found via the Phase 4
// eval run: 5 layers, strictly increasing throughout, so deriveCurveType
// returns "AAA" (one letter per 3-layer window). That's a genuinely
// single-type curve correctly labeled "A" -- checkLabel must collapse the
// repeated letter and match, not flag every >3-layer A-type as a mismatch.
test('Egwi (Etche): published A, genuinely monotonic -- must NOT flag as a mismatch', () => {
  const reading = {
    station: 'Egwi',
    curveTypePublished: 'A',
    layers: [
      {layerIndex: 1, resistivityOhmM: 295.88},
      {layerIndex: 2, resistivityOhmM: 798.6},
      {layerIndex: 3, resistivityOhmM: 864.62},
      {layerIndex: 4, resistivityOhmM: 1810.2},
      {layerIndex: 5, resistivityOhmM: 5634.2},
    ],
  }
  const {derived, matches} = checkLabel(reading)
  assert.equal(derived, 'AAA')
  assert.equal(matches, true)
})

test('Odufor (Etche): published A, but the numbers say otherwise', () => {
  const reading = {
    station: 'Odufor',
    curveTypePublished: 'A',
    layers: [
      {layerIndex: 1, resistivityOhmM: 20.32},
      {layerIndex: 2, resistivityOhmM: 851.16},
      {layerIndex: 3, resistivityOhmM: 2511.9},
      {layerIndex: 4, resistivityOhmM: 1345},
    ],
  }
  const {derived, matches} = checkLabel(reading)
  assert.equal(derived, 'AK')
  assert.equal(matches, false)
})

test('Opiro (Etche): published A, but the numbers say otherwise', () => {
  const reading = {
    station: 'Opiro',
    curveTypePublished: 'A',
    layers: [
      {layerIndex: 1, resistivityOhmM: 54.639},
      {layerIndex: 2, resistivityOhmM: 9147.8},
      {layerIndex: 3, resistivityOhmM: 1119.9},
      {layerIndex: 4, resistivityOhmM: 2566.8},
    ],
  }
  const {derived, matches} = checkLabel(reading)
  assert.equal(derived, 'KH')
  assert.equal(matches, false)
})
