import type { Block } from 'payload'

export const PackageBlock: Block = {
  slug: 'packageBlock',
  interfaceName: 'PackageBlockType',
  fields: [
    {
      name: 'postId',
      type: 'text',
      label: 'Property ID',
      admin: {
        description: 'The ID of the property (post) to create packages for. Leave empty to use the current page\'s post.',
      },
    },
  ],
  labels: {
    singular: 'Smart Package Creator',
    plural: 'Smart Package Creators',
  },
}

