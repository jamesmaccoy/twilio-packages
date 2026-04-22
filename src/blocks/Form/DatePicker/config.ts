import type { Block } from 'payload'

export const DatePickerBlock: Block = {
  slug: 'datePicker',
  labels: {
    singular: 'Date Picker',
    plural: 'Date Pickers',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'label',
      type: 'text',
    },
    {
      name: 'width',
      type: 'number',
    },
    {
      name: 'maxDays',
      type: 'number',
      label: 'Maximum Days',
    },
    {
      name: 'required',
      type: 'checkbox',
      label: 'Required',
    },
  ],
} 