import type { Block } from 'payload'

export const GalleryBlock: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'Gallery Items',
      required: true,
      fields: [
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          required: false,
        },
        {
          name: 'staticImage',
          type: 'text', // For static images, you may want to use a custom field or handle this in code
          required: false,
        },
        {
          name: 'caption',
          type: 'richText',
          required: false,
        },
      ],
    },
    {
      name: 'galleryCaption',
      type: 'richText',
      label: 'Gallery Caption',
      required: false,
    },
  ],
} 