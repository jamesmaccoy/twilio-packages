import React from 'react'

/** Shared overlay for throttled post images (non-subscribers). */
export function MembersOnlyImageOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black/20 p-2 pointer-events-none">
      <div className="max-w-full text-center rounded border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
        <p className="text-xs font-semibold leading-snug text-white/90 sm:text-sm">For members only</p>
        <p className="mt-0.5 text-[10px] leading-snug text-white/80 sm:text-xs">Subscribe to view full image</p>
      </div>
    </div>
  )
}
