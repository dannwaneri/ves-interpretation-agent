import {defineType, defineField, defineArrayMember} from 'sanity'
import {BarChartIcon} from '@sanity/icons/BarChart'

export const vesReading = defineType({
  name: 'vesReading',
  title: 'VES Reading',
  type: 'document',
  icon: BarChartIcon,
  description:
    'One reported reading for one station, as stated in one specific place in a paper. A station can have more than one vesReading document when a paper reports the same station differently in different tables or figures. Model each claim separately instead of merging them, so the disagreement stays visible.',
  fields: [
    defineField({
      name: 'station',
      title: 'Station ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'site',
      type: 'reference',
      to: [{type: 'surveySite'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'paper',
      title: 'Source paper',
      type: 'reference',
      to: [{type: 'surveyPaper'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceLocation',
      title: 'Where in the paper this reading comes from',
      type: 'string',
      description: 'E.g. "Figure 2 panel (b) caption" or "p.7 summary table, row \'Kenpoly sec school field\'". Required for every reading. This is what lets two disagreeing readings for the same station stay traceable to exactly where each one came from.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'aquiferLithology',
      type: 'string',
    }),
    defineField({
      name: 'curveTypePublished',
      title: 'Curve type as published',
      type: 'string',
      description: 'The curve type label as printed in the paper (e.g. "A", "KH"), even if the underlying layer sequence does not strictly match that label. Do not correct it here. That correction is the agent\'s job at query time.',
    }),
    defineField({
      name: 'rmsPercent',
      title: 'RMS misfit (%)',
      type: 'number',
    }),
    defineField({
      name: 'layers',
      title: 'Inverted layers',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'layer',
          fields: [
            defineField({name: 'layerIndex', type: 'number', validation: (rule) => rule.required()}),
            defineField({name: 'resistivityOhmM', type: 'number', validation: (rule) => rule.required()}),
            defineField({name: 'thicknessM', type: 'number'}),
            defineField({name: 'cumulativeDepthM', type: 'number'}),
          ],
          preview: {
            select: {resistivity: 'resistivityOhmM', depth: 'cumulativeDepthM'},
            prepare({resistivity, depth}) {
              return {title: `${resistivity} Ω·m @ ${depth} m`}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'reportedAquiferResistivityOhmM',
      title: 'Reported aquifer resistivity (Ω·m)',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'reportedAquiferDepthM',
      title: 'Reported aquifer depth (m)',
      type: 'number',
    }),
    defineField({
      name: 'reportedAquiferThicknessM',
      title: 'Reported aquifer thickness (m)',
      type: 'number',
    }),
    defineField({
      name: 'transcriptionNote',
      title: 'Transcription note',
      type: 'text',
      description:
        'Anything worth flagging about this specific reading: arithmetic that does not reconcile, a mislabeled row, etc. State it as fact.',
    }),
  ],
  preview: {
    select: {title: 'station', subtitle: 'sourceLocation'},
  },
})
