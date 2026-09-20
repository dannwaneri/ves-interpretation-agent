import {defineType, defineField} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons/DocumentText'

export const surveyPaper = defineType({
  name: 'surveyPaper',
  title: 'Survey Paper',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'authors',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'journal',
      type: 'string',
    }),
    defineField({
      name: 'year',
      type: 'number',
    }),
    defineField({
      name: 'citation',
      title: 'Full citation',
      type: 'text',
      description: 'Complete citation text, as it should be attributed.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'doi',
      title: 'DOI',
      type: 'url',
    }),
    defineField({
      name: 'license',
      type: 'string',
      options: {
        list: [
          {title: 'CC BY 4.0', value: 'cc-by-4.0'},
          {title: 'Not explicitly marked CC (attribute, do not redistribute PDF)', value: 'unmarked'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'sourceNotes',
      title: 'Known source inconsistencies',
      type: 'text',
      description:
        'Disclose anything odd found in this paper while transcribing it: swapped tables, arithmetic that does not reconcile, loose terminology, etc. This is read by the Knowledge Base and the agent, so write it as a fact, not a footnote.',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'journal'},
  },
})
