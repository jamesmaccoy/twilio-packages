"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowRight, ImagePlus, X } from 'lucide-react'

async function uploadHeroMedia(file: File, alt: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append(
    '_payload',
    JSON.stringify({
      alt: alt.slice(0, 200) || 'Property listing hero',
    }),
  )
  const res = await fetch('/api/media', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      data?.errors?.[0]?.message ||
      data?.error ||
      'Image upload failed'
    throw new Error(msg)
  }
  const id = data?.doc?.id ?? data?.id
  if (!id || typeof id !== 'string') {
    throw new Error('Upload succeeded but media id was not returned')
  }
  return id
}

export default function NewPropertyOnboardingClient() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [wifi, setWifi] = useState('')
  const [lockbox, setLockbox] = useState('')
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!heroFile) {
      setHeroPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(heroFile)
    setHeroPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [heroFile])

  const canSubmit = title.trim().length > 0

  const clearHero = () => setHeroFile(null)

  const handleCreate = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      let heroImageId: string | undefined
      if (heroFile) {
        heroImageId = await uploadHeroMedia(heroFile, title.trim())
      }

      const res = await fetch('/api/posts/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          ...(wifi.trim() ? { wifi: wifi.trim() } : {}),
          ...(lockbox.trim() ? { lockbox: lockbox.trim() } : {}),
          ...(heroImageId ? { heroImage: heroImageId } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create property')
      }

      const postId = data?.post?.id || data?.postId
      if (!postId) throw new Error('Draft property created but id missing')

      router.push(`/manage?postId=${encodeURIComponent(postId)}&onboard=1`)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-10 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create a property</h1>
          <p className="text-slate-500 mt-1">
            Add a title and description first. Next, we’ll generate and assign packages.
          </p>
        </div>
        <Link href="/manage" className="text-sm text-slate-600 hover:text-slate-900">
          Back to manage
        </Link>
      </div>

      <Card className="border-2 border-slate-200 shadow-lg">
        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Seaside Cottage in Paternoster"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description guests will see. You can edit later."
              className="min-h-[140px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">WiFi (optional)</label>
              <Input
                value={wifi}
                onChange={(e) => setWifi(e.target.value)}
                placeholder="Network name and password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Lockbox / access (optional)</label>
              <Input
                value={lockbox}
                onChange={(e) => setLockbox(e.target.value)}
                placeholder="Key safe code or entry instructions"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hero image (optional)</label>
            <p className="text-sm text-slate-500 mb-3">
              Main photo for the listing header. You can change it later in the editor.
            </p>
            {!heroFile ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer bg-slate-50/80 hover:bg-slate-50 transition-colors">
                <ImagePlus className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600">Click to upload an image</span>
                <span className="text-xs text-slate-400 mt-1">JPEG, PNG, or WebP</span>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setHeroFile(f ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[21/9] max-h-48">
                {heroPreviewUrl ? (
                  <Image
                    src={heroPreviewUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-9 w-9 rounded-full shadow-md"
                  onClick={clearHero}
                  aria-label="Remove hero image"
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-3 py-1.5 truncate">
                  {heroFile.name}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleCreate}
              disabled={!canSubmit || submitting}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Continue to packages
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

