// Classifies a VES resistivity sounding curve from its own layer values,
// instead of trusting the curve-type label printed in the source paper.
// Standard geoelectric letter types for three consecutive layers:
//   A: r1 < r2 < r3   Q: r1 > r2 > r3   H: r1 > r2 < r3   K: r1 < r2 > r3
// A curve with more than 3 layers gets one letter per group of 3
// consecutive layers (a 4-layer curve returns 2 letters, e.g. "HA").

function letterFor(r1, r2, r3) {
  if (r1 === r2 || r2 === r3) return '?'
  if (r1 < r2 && r2 < r3) return 'A'
  if (r1 > r2 && r2 > r3) return 'Q'
  if (r1 > r2 && r2 < r3) return 'H'
  if (r1 < r2 && r2 > r3) return 'K'
  return '?'
}

function deriveCurveType(layers) {
  if (!Array.isArray(layers) || layers.length < 3) {
    throw new Error('deriveCurveType requires at least 3 layers, in depth order')
  }
  const r = layers.map((l) => l.resistivityOhmM)
  let letters = ''
  for (let i = 0; i + 2 < r.length; i++) {
    letters += letterFor(r[i], r[i + 1], r[i + 2])
  }
  return letters
}

function sortLayersByDepth(layers) {
  return [...layers].sort((a, b) => {
    if (typeof a.layerIndex === 'number' && typeof b.layerIndex === 'number') {
      return a.layerIndex - b.layerIndex
    }
    return (a.cumulativeDepthM ?? 0) - (b.cumulativeDepthM ?? 0)
  })
}

// A curve with N>3 layers that is genuinely one consistent type all the way
// down derives as that letter repeated (e.g. "AAA" for 5 strictly rising
// layers) -- that IS a single-type curve, just spelled out one letter per
// triplet, so it still counts as matching a single-letter published label.
// A mixed string ("KHA", "AK", ...) means the trend actually changes
// partway through, which a single-letter label can never truthfully match.
function collapseIfUniform(letters) {
  return [...new Set(letters)].length === 1 ? letters[0] : letters
}

// Compares the type derived from a vesReading's own layer values against
// the curveTypePublished label from the paper. A mismatch means the label
// is a claim, not a fact -- see the layers themselves for what actually happens.
function checkLabel(reading) {
  const layers = sortLayersByDepth(reading.layers || [])
  const derived = deriveCurveType(layers)
  const published = (reading.curveTypePublished || '').trim().toUpperCase()
  return {
    station: reading.station,
    derived,
    published,
    matches: published.length > 0 && collapseIfUniform(derived) === published,
  }
}

module.exports = {deriveCurveType, sortLayersByDepth, checkLabel}
