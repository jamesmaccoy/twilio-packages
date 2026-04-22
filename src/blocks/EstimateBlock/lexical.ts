import { BlocksFeature } from '@payloadcms/richtext-lexical'
import { StayDuration as EstimateBlockConfig } from './config'

export const EstimateBlockFeature = () => {
  return BlocksFeature({
    blocks: [EstimateBlockConfig],
  })
} 