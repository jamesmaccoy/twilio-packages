'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { PostHero } from './index'
import type { Post } from '@/payload-types'

export const PostHeroWrapper: React.FC<{
  post: Post
}> = ({ post }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PostHero post={post} />
    </motion.div>
  )
}

