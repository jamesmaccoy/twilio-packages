import type { CollectionConfig } from 'payload'

import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { hostOwnsPost } from '../../access/hostOwnsPost'
import { adminOrHost } from '../../access/adminOrHost'
import { adminOrHostOwnPost } from '../../access/adminOrHostOwnPost'
import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { populateAuthors } from './hooks/populateAuthors'
import { revalidateDelete, revalidatePost } from './hooks/revalidatePost'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { slugField } from '@/fields/slug'

export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  access: {
    create: adminOrHost,
    delete: adminOrHostOwnPost,
    read: hostOwnsPost,
    update: adminOrHostOwnPost,
  },
  // This config controls what's populated by default when a post is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'posts'>
  defaultPopulate: {
    title: true,
    slug: true,
    categories: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    defaultColumns: ['title', 'slug', 'featured', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) => {
        const path = generatePreviewPath({
          slug: typeof data?.slug === 'string' ? data.slug : '',
          collection: 'posts',
          req,
        })

        return path
      },
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: typeof data?.slug === 'string' ? data.slug : '',
        collection: 'posts',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'host',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'content',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            {
              name: 'relatedPosts',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              // Temporarily disabled filterOptions to fix static generation issue
              // filterOptions will be re-enabled once Payload fixes the context issue during static generation
              // filterOptions: (context) => {
              //   // Safely handle context that might be undefined or missing id during static generation
              //   if (!context || typeof context !== 'object') {
              //     return {}
              //   }
              //   
              //   const id = (context as any)?.id
              //   if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
              //     return {}
              //   }
              //   
              //   return {
              //     id: {
              //       not_in: [String(id)],
              //     },
              //   }
              // },
              hasMany: true,
              relationTo: 'posts',
            },
            {
              name: 'categories',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              hasMany: true,
              relationTo: 'categories',
            },
            {
              name: 'featured',
              type: 'checkbox',
              label: 'Featured',
              defaultValue: false,
              admin: {
                position: 'sidebar',
                description: 'Feature this post on the editorial home page',
              },
            },
          ],
          label: 'Meta',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'authors',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'users',
    },
    // This field is only used to populate the user data via the `populateAuthors` hook
    // This is because the `user` collection has access control locked to protect user privacy
    // GraphQL will also not return mutated user data that differs from the underlying schema
    {
      name: 'populatedAuthors',
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
    {
      name: 'baseRate',
      type: 'number',
      label: 'Base Rate (per night)',
      required: false,
      min: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'googleCalendarUrl',
      type: 'text',
      label: 'Google Calendar iCal URL',
      admin: {
        position: 'sidebar',
        description: 'Public iCal feed URL for Google Calendar (e.g., https://calendar.google.com/calendar/ical/.../public/basic.ics). This calendar will be checked for availability alongside bookings.',
      },
    },
    {
      name: 'packageSettings',
      type: 'array',
      label: 'Package Settings',
      admin: {
        position: 'sidebar',
        description: 'Custom settings for packages associated with this post',
      },
      fields: [
        {
          name: 'package',
          type: 'relationship',
          relationTo: 'packages',
          required: true,
        },
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Enabled',
        },
        {
          name: 'customName',
          type: 'text',
          label: 'Custom Name',
        },
      ],
    },
    ...slugField(),
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const user = (req as any)?.user
        const role = (user as any)?.role
        const roleArray = Array.isArray(role) ? role : role ? [role] : []
        const isHost = roleArray.includes('host')
        const isAdmin = roleArray.includes('admin')

        if (!user || !isHost) return data

        // On create, or if host field missing, pin host ownership to the acting host.
        if (operation === 'create' || !(data as any)?.host) {
          ;(data as any).host = user.id
        }

        // Ensure the acting host is always included in authors for backwards-compat ownership checks.
        const authorsValue = (data as any)?.authors
        const authors: string[] = Array.isArray(authorsValue)
          ? authorsValue.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean)
          : authorsValue
            ? [typeof authorsValue === 'string' ? authorsValue : authorsValue?.id].filter(Boolean)
            : []

        if (!authors.includes(String(user.id))) {
          ;(data as any).authors = [...authors, String(user.id)]
        }

        // Hosts can't remove/alter host ownership via payload admin shapes.
        if (!isAdmin) {
          ;(data as any).host = user.id
        }

        return data
      },
    ],
    afterChange: [revalidatePost],
    afterRead: [populateAuthors],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
