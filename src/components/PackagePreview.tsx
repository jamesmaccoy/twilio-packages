"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { formatAmountToZARNoCents } from "@/lib/currency"

interface PackagePreviewProps {
  name: string
  description: string
  category: 'standard' | 'hosted' | 'addon' | 'special'
  entitlement?: 'standard' | 'pro'
  minNights?: number
  maxNights?: number
  baseRate?: number // in rands (ZAR)
  multiplier?: number
  features?: string[]
  isPreview?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  isSaving?: boolean
}

export function PackagePreview({
  name,
  description,
  category,
  entitlement = 'standard',
  minNights = 1,
  maxNights = 7,
  baseRate,
  multiplier = 1,
  features = [],
  isPreview = true,
  onConfirm,
  onCancel,
  isSaving = false,
}: PackagePreviewProps) {
  const emoji = name.split(' ')[0] || '📦'
  const displayName = name.substring(name.indexOf(' ') + 1) || name

  return (
    <Card className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full">
      {/* Card Header / Visual Anchor */}
      <div className="h-32 bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-center relative">
        <div className="text-4xl filter grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110">
          {emoji}
        </div>
        <div className="absolute top-4 right-4">
          {isPreview ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Preview
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase text-slate-500 bg-slate-100 mb-2">
              {category}
            </span>
            <h3 className="text-lg font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
              {displayName}
            </h3>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">
          {description || 'No description provided'}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm border-t border-slate-100 pt-4 mt-auto">
          <div className="flex items-center text-slate-600">
            <Clock className="w-4 h-4 mr-2 text-slate-400" />
            <span>
              {minNights}-{maxNights} nights
            </span>
          </div>
          <div className="flex items-center text-slate-600">
            <Users className="w-4 h-4 mr-2 text-slate-400" />
            <span className="capitalize">{entitlement}</span>
          </div>
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Features:</p>
            <div className="flex flex-wrap gap-1">
              {features.slice(0, 3).map((feature, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
              {features.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{features.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Footer Price */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Base Rate</span>
            <span className="text-lg font-bold text-slate-900">
              {baseRate && baseRate > 0 ? formatAmountToZARNoCents(baseRate) : 'Not set'}
            </span>
            {multiplier !== 1 && (
              <span className="text-xs text-slate-400">Multiplier: {multiplier}x</span>
            )}
          </div>
        </div>

        {/* Preview Actions */}
        {isPreview && (onConfirm || onCancel) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSaving}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            {onConfirm && (
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={isSaving}
                className="flex-1 bg-slate-900 hover:bg-slate-800"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Create Package
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

