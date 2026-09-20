import {defineType, defineField} from 'sanity'
import {PinIcon} from '@sanity/icons/Pin'

export const surveySite = defineType({
  name: 'surveySite',
  title: 'Survey Site',
  type: 'document',
  icon: PinIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'location',
      type: 'geopoint',
    }),
    defineField({
      name: 'lga',
      title: 'Local Government Area',
      type: 'string',
    }),
    defineField({
      name: 'state',
      type: 'string',
    }),
    defineField({
      name: 'paper',
      title: 'Source paper',
      type: 'reference',
      to: [{type: 'surveyPaper'}],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'lga'},
  },
})
