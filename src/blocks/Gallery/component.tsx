import type { StaticImageData } from 'next/image'
import { cn } from 'src/utilities/cn'
import React from 'react'
import RichText from '@/components/RichText'
import type { Media as MediaType } from '@/payload-types'
import { Media } from '../../components/Media'

export type GalleryItem = {
  media?: MediaType
  staticImage?: StaticImageData
  caption?: any // RichText data
}

export type GalleryBlockProps = {
  items: GalleryItem[]
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  galleryCaption?: any // RichText data
  captionClassName?: string
  disableInnerContainer?: boolean
  
}


export const GalleryBlock: React.FC<GalleryBlockProps> = ({
  items,
  className,
  enableGutter = true,
  imgClassName,
  galleryCaption,
  captionClassName,
  disableInnerContainer,
  
}) => {
  return (
    
    <div
      className={cn(
        '',
        {
          container: enableGutter,
        },
        className,
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {items?.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            {(item.media || item.staticImage) && (
              <Media
                imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
                resource={item.media}
                src={item.staticImage}
              />
            )}
            {item.caption && (
              <div className={cn('mt-3', captionClassName)}>
                <RichText data={item.caption} enableGutter={false} />
              </div>
            )}
          </div>
        ))}
      </div>
      {galleryCaption && (
        <div
          className={cn(
            'mt-8',
            {
              container: !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText data={galleryCaption} enableGutter={false} />
        </div>
      )}
    </div>
  )
}
