'use client'

import React from 'react'
import { SmartPackageBlock } from './SmartPackageBlock'
import type { PackageBlockType } from './types'
import { useParams } from 'next/navigation'

export type PackageBlockProps = PackageBlockType & {
  className?: string
}

export const PackageBlock: React.FC<PackageBlockProps> = ({
  className,
  postId: blockPostId,
  blockType = 'packageBlock',
}) => {
  // Get postId from URL params if not provided in block config
  const params = useParams()
  const urlPostId = params?.postId as string | undefined
  
  // Use blockPostId if provided, otherwise fall back to URL param
  const effectivePostId = blockPostId || urlPostId || ''

  if (!effectivePostId) {
    return (
      <div className={className}>
        <div className="p-6 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground text-center">
            Please provide a post ID or use this block on a post page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SmartPackageBlock
      className={className}
      postId={effectivePostId}
      blockType={blockType}
    />
  )
}

