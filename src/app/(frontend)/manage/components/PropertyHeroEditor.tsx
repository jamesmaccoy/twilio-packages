"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ImagePlus, Loader2, MoreHorizontal, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Media } from "@/payload-types"

type PropertyHeroEditorProps = {
  postId: string
  /** Called after the listing is deleted on the server so the parent can update lists/selection without waiting for refresh. */
  onListingDeleted?: (postId: string) => void
}

async function uploadMedia(file: File, alt: string): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  fd.append(
    "_payload",
    JSON.stringify({
      alt: (alt || "Property listing hero").slice(0, 200),
    }),
  )

  const res = await fetch("/api/media", {
    method: "POST",
    body: fd,
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (typeof data?.message === "string" && data.message) ||
      data?.errors?.[0]?.message ||
      data?.error ||
      "Image upload failed"
    throw new Error(msg)
  }
  const id = data?.doc?.id ?? data?.id
  if (!id || typeof id !== "string") {
    throw new Error("Upload succeeded but media id was not returned")
  }
  return id
}

export function PropertyHeroEditor({ postId, onListingDeleted }: PropertyHeroEditorProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [postTitle, setPostTitle] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [heroMedia, setHeroMedia] = useState<Media | null>(null)
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/posts/${postId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to load listing")
      setPostTitle(String(data?.doc?.title || ""))
      setMetaDescription(String(data?.doc?.meta?.description || ""))
      const nextHero =
        data?.doc?.heroImage && typeof data.doc.heroImage === "object"
          ? (data.doc.heroImage as Media)
          : null
      setHeroMedia(nextHero)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load listing")
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void loadPost()
  }, [loadPost])

  const clearPreview = () => {
    if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl)
    setHeroPreviewUrl(null)
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ""
    if (!file) return

    setError(null)
    setUploading(true)
    const preview = URL.createObjectURL(file)
    setHeroPreviewUrl(preview)

    try {
      const mediaId = await uploadMedia(file, postTitle)
      const patchRes = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImage: mediaId,
          meta: {
            image: mediaId,
          },
        }),
      })
      const patchData = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) {
        throw new Error(patchData?.error || "Failed to save hero image")
      }
      const updatedHero =
        patchData?.doc?.heroImage && typeof patchData.doc.heroImage === "object"
          ? (patchData.doc.heroImage as Media)
          : null
      setHeroMedia(updatedHero)
      URL.revokeObjectURL(preview)
      setHeroPreviewUrl(null)
      router.refresh()
    } catch (err: unknown) {
      URL.revokeObjectURL(preview)
      setHeroPreviewUrl(null)
      setError(err instanceof Error ? err.message : "Failed to update hero image")
    } finally {
      setUploading(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!postTitle.trim()) {
      setError("Title is required")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postTitle.trim().slice(0, 120),
          meta: {
            description: metaDescription.trim() || null,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to save listing")
      setEditOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save listing")
    } finally {
      setSaving(false)
    }
  }

  const imageSrc =
    heroPreviewUrl ||
    (heroMedia?.sizes?.large?.url || heroMedia?.url
      ? (heroMedia.sizes?.large?.url || heroMedia.url) as string
      : null)

  const clearHeroImage = async () => {
    if (heroPreviewUrl) {
      clearPreview()
      return
    }
    if (!heroMedia) return
    setError(null)
    setUploading(true)
    try {
      const patchRes = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImage: null,
          meta: {
            image: null,
          },
        }),
      })
      const patchData = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) throw new Error(patchData?.error || "Failed to remove hero image")
      setHeroMedia(null)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove hero image")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete listing")
      }

      onListingDeleted?.(postId)
      setConfirmDeleteOpen(false)
      setEditOpen(false)
      router.push("/manage")
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete listing")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="flex flex-row items-center gap-3 sm:gap-4">
        <div className="relative h-14 w-24 sm:h-16 sm:w-28 flex-shrink-0 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
              Loading…
            </div>
          ) : imageSrc ? (
            <Image
              src={imageSrc}
              alt={heroMedia?.alt || "Listing hero"}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-2 text-center">
              <ImagePlus className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-[11px] leading-tight">No cover photo</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Selected property</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{postTitle || "Untitled"}</p>
          {error ? <p className="text-xs text-red-600 mt-2">{error}</p> : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={loading}
                aria-label="Listing actions"
                title="Actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setMenuOpen(false)
                    setEditOpen(true)
                  }}
                >
                  Edit / Delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setMenuOpen(false)
                    window.open("/manage/preview-user", "_blank", "noopener,noreferrer")
                  }}
                >
                  Preview as user
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Main edit modal */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            clearPreview()
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit property</DialogTitle>
            <DialogDescription>Edit listing title, description, and hero image.</DialogDescription>
          </DialogHeader>

          <div className="container max-w-3xl mx-auto py-8 px-6 sm:px-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Edit property</h2>
                <p className="text-slate-500 mt-1">
                  Add a title and description first. Next, we’ll generate and assign packages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Back to manage
              </button>
            </div>

            <Card className="border-2 border-slate-200 shadow-lg">
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                  <Input
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="e.g., Seaside Cottage in Paternoster"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description (optional)</label>
                  <Textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="A short description guests will see. You can edit later."
                    className="min-h-[140px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Hero image (optional)</label>
                  <p className="text-sm text-slate-500 mb-3">
                    Main photo for the listing header. You can change it later in the editor.
                  </p>
                  {!imageSrc ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer bg-slate-50/80 hover:bg-slate-50 transition-colors">
                      <ImagePlus className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-600">Click to upload an image</span>
                      <span className="text-xs text-slate-400 mt-1">JPEG, PNG, or WebP</span>
                      <Input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={onFileChange}
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[21/9] max-h-48">
                      <Image src={imageSrc} alt="" fill className="object-cover" unoptimized />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 h-9 w-9 rounded-full shadow-md"
                        onClick={() => void clearHeroImage()}
                        disabled={uploading}
                        aria-label="Remove hero image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-3 py-1.5 truncate">
                        {heroPreviewUrl
                          ? "Preview"
                          : heroMedia?.filename || "Current image"}
                      </p>
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
                ) : null}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleting || saving || uploading || loading}
                    className="w-full sm:w-auto"
                  >
                    Delete listing
                  </Button>
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                      disabled={saving}
                      className="border-slate-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveMeta()}
                      disabled={saving || loading || !postTitle.trim()}
                      className="bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this property listing?</DialogTitle>
            <DialogDescription>
              This will permanently delete the listing{postTitle ? ` “${postTitle}”` : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Yes, delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
