import { getClientSideURL } from '@/utilities/getURL'

/**
 * Returns the full URL for a media item given its ID.
 * @param mediaId The media ID (string)
 * @returns The full URL to the media file, or null if invalid
 */
export function getMediaUrl(mediaId?: string | null): string | null {
  if (!mediaId || typeof mediaId !== 'string') return null;
  // You may need to adjust the path if your API is different
  return `${getClientSideURL()}/media/${mediaId}`;
} 