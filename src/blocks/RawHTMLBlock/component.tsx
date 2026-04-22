import React from 'react'

export type RawHTMLBlockProps = {
  html: string
  className?: string
}

export const RawHTMLBlock: React.FC<RawHTMLBlockProps> = ({ html, className }) => {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
} 