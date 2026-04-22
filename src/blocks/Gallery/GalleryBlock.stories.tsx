import React from 'react'
import { GalleryBlock, GalleryItem } from './component'

// Mock data for demonstration
const mockItems: GalleryItem[] = [
  {
    media: {
      id: '1',
      alt: 'Image 1',
      url: '/mock/image1.jpg',
      caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 1', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
      updatedAt: '',
      createdAt: '',
      width: 800,
      height: 600,
    },
    caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 1', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
  },
  {
    media: {
      id: '2',
      alt: 'Image 2',
      url: '/mock/image2.jpg',
      caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 2', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
      updatedAt: '',
      createdAt: '',
      width: 800,
      height: 600,
    },
    caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 2', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
  },
  {
    media: {
      id: '3',
      alt: 'Image 3',
      url: '/mock/image3.jpg',
      caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 3', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
      updatedAt: '',
      createdAt: '',
      width: 800,
      height: 600,
    },
    caption: { root: { type: 'root', children: [{ type: 'text', text: 'Caption 3', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } },
  },
]

const galleryCaption = { root: { type: 'root', children: [{ type: 'text', text: 'This is a gallery-level caption.', version: 1 }], direction: 'ltr', format: '', indent: 0, version: 1 } }

export default {
  title: 'Blocks/GalleryBlock',
  component: GalleryBlock,
}

export const Default = () => (
  <GalleryBlock
    items={mockItems}
    galleryCaption={galleryCaption}
  />
) 