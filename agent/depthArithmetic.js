// Checks a reading's own layer table for internal arithmetic consistency:
// each layer's cumulative depth should equal the previous layer's
// cumulative depth plus this layer's thickness. A printed value that's off
// by more than the paper's own rounding is a transcription error (see
// source_errors/data_inconsistencies in the Knowledge Base for the Etche
// cases this was built to catch), not a geology judgment call.
//
// Tolerance is deliberately generous, not tight: published tables round
// thickness/depth to 1-3 significant digits, so ordinary rounding alone can
// produce ~0.3 m of drift even on a station with no known issue (confirmed
// against Bori's Court-road, which has no documented problem). The real
// documented errors are off by ~7-10 m -- a wide enough gap that 1.0 m
// cleanly separates rounding noise from an actual transcription error.
const TOLERANCE_M = 1.0

function sortLayersByIndex(layers) {
  return [...layers].sort((a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0))
}

function checkDepthArithmetic(reading) {
  const layers = sortLayersByIndex(reading.layers || [])
  for (let i = 1; i < layers.length; i++) {
    const prev = layers[i - 1]
    const cur = layers[i]
    if (
      typeof prev.cumulativeDepthM !== 'number' ||
      typeof cur.cumulativeDepthM !== 'number' ||
      typeof cur.thicknessM !== 'number'
    ) {
      continue
    }
    const expected = prev.cumulativeDepthM + cur.thicknessM
    const diff = Math.abs(expected - cur.cumulativeDepthM)
    if (diff > TOLERANCE_M) {
      return {
        station: reading.station,
        matches: false,
        layerIndex: cur.layerIndex,
        printed: cur.cumulativeDepthM,
        calculated: Number(expected.toFixed(4)),
        priorCumulativeDepthM: prev.cumulativeDepthM,
        thicknessM: cur.thicknessM,
      }
    }
  }
  return {station: reading.station, matches: true}
}

module.exports = {checkDepthArithmetic}
