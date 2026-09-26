const {test} = require('node:test')
const assert = require('node:assert/strict')
const {tableSwapChecks} = require('./tableSwap.js')

// Real values for the Bori table swap, read live via groq_query on
// 2026-09-26. BMGS-bori-field's own figure-caption document says 2950; the
// summary-table document filed under the same station name says 3706.
test('BMGS-bori-field: trusts the figure caption over the summary table', () => {
  const rows = [
    {
      _id: 'reading-bori-bmgs-bori-field',
      station: 'BMGS-bori-field',
      sourceLocation: 'Figure 2 panel caption (IPI2Win-inverted layer table)',
      reportedAquiferResistivityOhmM: 2950,
    },
    {
      _id: 'reading-bori-bmgs-bori-field-p7table',
      station: 'BMGS-bori-field',
      sourceLocation: "p.7 Table 1 (summary table), row printed 'BMGS bori field'",
      reportedAquiferResistivityOhmM: 3706,
    },
    {
      _id: 'reading-bori-court-road',
      station: 'Court-road',
      sourceLocation: 'Figure 2 panel caption (IPI2Win-inverted layer table)',
      reportedAquiferResistivityOhmM: 701,
    },
  ]
  const checks = tableSwapChecks(rows)
  assert.equal(checks.length, 1)
  assert.equal(checks[0].station, 'BMGS-bori-field')
  assert.equal(checks[0].trustedValue, 2950)
  assert.equal(checks[0].trustedDocumentId, 'reading-bori-bmgs-bori-field')
})

test('a single, uncontested reading produces no check', () => {
  const rows = [
    {
      _id: 'reading-bori-court-road',
      station: 'Court-road',
      sourceLocation: 'Figure 2 panel caption (IPI2Win-inverted layer table)',
      reportedAquiferResistivityOhmM: 701,
    },
  ]
  assert.deepEqual(tableSwapChecks(rows), [])
})
