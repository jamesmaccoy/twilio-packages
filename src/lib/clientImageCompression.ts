export type CompressImageOptions = {
  /** Maximum output bytes target (best-effort). */
  maxBytes?: number
  /** Longest edge in pixels. */
  maxDimension?: number
  /** Start quality for JPEG outputs. */
  initialQuality?: number
}

function isImageFile(file: File): boolean {
  return typeof file.type === 'string' && file.type.startsWith('image/')
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap typically respects EXIF orientation on modern browsers.
  // If it fails, caller should handle exception.
  return await createImageBitmap(file)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to encode image'))
        resolve(blob)
      },
      type,
      quality,
    )
  })
}

/**
 * Best-effort client-side resize/compress to keep uploads under serverless body limits.
 * - Converts to JPEG by default for maximum size reduction.
 * - If compression fails, returns the original file.
 */
export async function compressImageForUpload(file: File, opts: CompressImageOptions = {}): Promise<File> {
  if (!isImageFile(file)) return file

  const maxBytes = typeof opts.maxBytes === 'number' ? opts.maxBytes : 3_500_000 // ~3.5MB
  const maxDimension = typeof opts.maxDimension === 'number' ? opts.maxDimension : 1800
  const initialQuality = typeof opts.initialQuality === 'number' ? opts.initialQuality : 0.82

  // Already small enough; keep original to preserve format (e.g. png/webp) when possible.
  if (file.size <= maxBytes) return file

  try {
    const bmp = await fileToImageBitmap(file)

    const srcW = bmp.width || 0
    const srcH = bmp.height || 0
    if (!srcW || !srcH) return file

    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
    const outW = Math.max(1, Math.round(srcW * scale))
    const outH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bmp, 0, 0, outW, outH)

    // Iteratively reduce quality until within size budget (best-effort).
    let quality = initialQuality
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    while (blob.size > maxBytes && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.08)
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    // If still too big, do one more downscale step.
    if (blob.size > maxBytes) {
      const scale2 = 0.85
      const outW2 = Math.max(1, Math.round(outW * scale2))
      const outH2 = Math.max(1, Math.round(outH * scale2))
      canvas.width = outW2
      canvas.height = outH2
      const ctx2 = canvas.getContext('2d')
      if (!ctx2) return file
      ctx2.drawImage(bmp, 0, 0, outW2, outH2)
      quality = Math.max(0.6, quality)
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    const nameBase = file.name.replace(/\.[^.]+$/, '') || 'upload'
    const outFile = new File([blob], `${nameBase}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })

    // If we didn't actually reduce size meaningfully, keep original.
    if (outFile.size >= file.size * 0.95) return file
    return outFile
  } catch {
    return file
  }
}

