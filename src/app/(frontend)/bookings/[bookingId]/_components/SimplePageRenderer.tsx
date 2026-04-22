'use client'

import React from 'react'
import RichText from '@/components/RichText'
import { Media } from '@/components/Media'
import { CMSLink } from '@/components/Link'
import { FormBlock } from '@/blocks/Form/Component'

interface SimplePageRendererProps {
  page: any
}

export default function SimplePageRenderer({ page }: SimplePageRendererProps) {
  // Render hero section if present
  const renderHero = () => {
    if (!page.hero) return null

    const { type, richText, media, links } = page.hero

    return (
      <div className="mb-8">
        {richText && (
          <div className="mb-4">
            <RichText data={richText} enableGutter={false} />
          </div>
        )}
        
        {Array.isArray(links) && links.length > 0 && (
          <div className="mb-4">
            {links.map((linkItem: any, index: number) => (
              <div key={index} className="mb-2">
                <CMSLink {...linkItem.link} />
              </div>
            ))}
          </div>
        )}

        {media && typeof media === 'object' && (
          <div className="mb-4">
            <Media
              resource={media}
              imgClassName="rounded-lg border"
            />
            {media.caption && (
              <div className="mt-2">
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render content block with columns
  const renderContentBlock = (block: any) => {
    if (!block.columns || !Array.isArray(block.columns)) {
      return null
    }

    return (
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {block.columns.map((column: any, colIndex: number) => (
            <div key={colIndex} className="space-y-2">
              {column.richText && (
                <RichText data={column.richText} enableGutter={false} />
              )}
              {column.link && (
                <div className="mt-2">
                  <CMSLink {...column.link} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render media block
  const renderMediaBlock = (block: any) => {
    if (!block.media) return null

    return (
      <div className="mb-6">
        <Media
          resource={block.media}
          imgClassName="rounded-lg border w-full"
        />
        {block.media.caption && (
          <div className="mt-2">
            <RichText data={block.media.caption} enableGutter={false} />
          </div>
        )}
      </div>
    )
  }

  // Render call to action block
  const renderCallToActionBlock = (block: any) => {
    return (
      <div className="mb-6 p-4 bg-muted rounded-lg">
        {block.heading && (
          <h3 className="font-semibold mb-2">{block.heading}</h3>
        )}
        {block.richText && (
          <RichText data={block.richText} enableGutter={false} />
        )}
        {block.links && Array.isArray(block.links) && (
          <div className="mt-4 space-y-2">
            {block.links.map((linkItem: any, index: number) => (
              <div key={index}>
                <CMSLink {...linkItem.link} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Render form block
  const renderFormBlock = (block: any) => {
    if (!block.form) return null

    return (
      <div className="mb-6">
        <FormBlock {...block} />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>No page data available.</p>
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-w-none">
      {/* Render hero section */}
      {renderHero()}

      {/* Render layout blocks */}
      {page.layout && Array.isArray(page.layout) && page.layout.map((block: any, index: number) => {
        switch (block.blockType) {
          case 'content':
            return (
              <div key={index}>
                {renderContentBlock(block)}
              </div>
            )
          
          case 'mediaBlock':
            return (
              <div key={index}>
                {renderMediaBlock(block)}
              </div>
            )
          
          case 'callToAction':
          case 'cta':
            return (
              <div key={index}>
                {renderCallToActionBlock(block)}
              </div>
            )
          
          case 'formBlock':
            return (
              <div key={index}>
                {renderFormBlock(block)}
              </div>
            )
          
          default:
            return (
              <div key={index} className="mb-4 p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  📄 {block.blockType || 'Content'} block
                </p>
                {block.heading && (
                  <p className="font-medium mt-1">{block.heading}</p>
                )}
                {block.richText && (
                  <div className="mt-2">
                    <RichText data={block.richText} enableGutter={false} />
                  </div>
                )}
              </div>
            )
        }
      })}
    </div>
  )
}
