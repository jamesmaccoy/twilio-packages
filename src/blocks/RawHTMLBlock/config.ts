import type { Block } from 'payload'

export const RawHTMLBlock: Block = {
  slug: 'rawHTML',
  interfaceName: 'RawHTMLBlock',
  fields: [
    {
      name: 'html',
      type: 'textarea',
      required: true,
      label: 'Raw HTML',
    },
    {
      name: 'className',
      type: 'text',
      required: false,
      label: 'CSS Class',
    },
  ],
} 