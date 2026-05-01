'use client'

import React from 'react'
import { Check, Coins, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { YocoProduct } from '@/lib/yocoService'

type TokenUsageSummary = {
  total: number | null
  prompt: number | null
  candidates: number | null
  cached: number | null
  thoughts: number | null
  timestamp: number
}

type PricingSectionProps = {
  standardProduct?: YocoProduct
  proProduct?: YocoProduct
  loadingProducts: boolean
  paymentLoading: boolean
  latestTokenUsage: TokenUsageSummary | null
  subscriptionStatus: {
    isSubscribed: boolean
    entitlements: string[]
  }
  onSubscribe: (product: YocoProduct | undefined) => void
}

export function PricingSection({
  standardProduct,
  proProduct,
  loadingProducts,
  paymentLoading,
  latestTokenUsage,
  subscriptionStatus,
  onSubscribe,
}: PricingSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Standard Access Card */}
      <motion.div
        whileHover={{
          y: -4,
        }}
        className="relative flex flex-col overflow-hidden rounded-lg border border-[#2dd4bf]/30 bg-white shadow-sm"
      >
        <div className="bg-[#f0fdfa] p-6">
          <div className="flex items-center justify-between">
            <Badge className="bg-[#2dd4bf] text-[#164e63] border-transparent">
              Standard Access
            </Badge>
            <div className="flex items-center gap-1 text-xs font-medium text-[#0f766e]">
              <Coins className="h-3 w-3" />
              Includes CID greening
            </div>
          </div>
          <h3 className="mt-4 text-2xl font-bold text-[#020817]">
            Membership
          </h3>
          <p className="mt-2 text-sm text-slate-500">
          Monthly membership to curated simple pleks with flexible bookings and
            package addons 
          </p>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="mb-6">
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing...
              </div>
            ) : standardProduct ? (
              <>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-[#020817]">
                    R{standardProduct.price.toFixed(2)}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    / {standardProduct.period}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span>
                    <strong>
                      {typeof latestTokenUsage?.total === 'number'
                        ? `${latestTokenUsage.total} Tokens`
                        : 'Tokens'}
                    </strong>{' '}
                    For rescheduling and cancellations
                  </span>
                </div>
                {latestTokenUsage && (
                  <p className="mt-2 text-xs text-slate-500">
                    Prompt {typeof latestTokenUsage.prompt === 'number' ? latestTokenUsage.prompt : '—'} • Response{' '}
                    {typeof latestTokenUsage.candidates === 'number' ? latestTokenUsage.candidates : '—'}
                    {typeof latestTokenUsage.cached === 'number' ? ` • Cached ${latestTokenUsage.cached}` : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Standard plan currently unavailable.</p>
            )}
          </div>

          <ul className="mb-8 flex-1 space-y-3 text-sm text-slate-600">
            {standardProduct?.features && Array.isArray(standardProduct.features) && standardProduct.features.length > 0 ? (
              standardProduct.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#2dd4bf]" />
                  <span>{typeof feature === 'string' ? feature : (feature as any).feature || feature}</span>
                </li>
              ))
            ) : (
              <>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#2dd4bf]" />
                  <span>Book pleks for weekly retreats</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#2dd4bf]" />
                  <span>Virtual wine curation with local makers</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#2dd4bf]" />
                  <span>Member pricing on hosted add-ons</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#2dd4bf]" />
                  <span>Supports CID greening events</span>
                </li>
              </>
            )}
          </ul>

          <Button
            onClick={() => onSubscribe(standardProduct)}
            disabled={!standardProduct || paymentLoading}
            className="w-full bg-[#2dd4bf] text-[#164e63] hover:bg-[#14b8a6]"
          >
            {paymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {subscriptionStatus.isSubscribed && subscriptionStatus.entitlements.includes('standard')
              ? 'Standard access active'
              : 'Subscribe with Yoco'}
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Secure payment • Cancel anytime
          </p>
        </div>
      </motion.div>

      {/* Pro Hosting Card */}
      <motion.div
        whileHover={{
          y: -4,
        }}
        className="relative flex flex-col overflow-hidden rounded-lg border border-[#0891b2] bg-white shadow-md ring-1 ring-[#0891b2]/20"
      >
        <div className="absolute -right-12 top-6 rotate-45 bg-[#0891b2] px-12 py-1 text-xs font-bold text-white shadow-sm">
          INVEST
        </div>

        <div className="bg-[#ecfeff] p-6">
          <div className="flex items-center justify-between">
            <Badge className="bg-[#0891b2] text-white border-transparent">
            Shareholder
            </Badge>
            <div className="flex items-center gap-1 text-xs font-medium text-[#0e7490]">
              <Zap className="h-3 w-3" />
           Development contribution
            </div>
          </div>
          <h3 className="mt-4 text-2xl font-bold text-[#020817]">
            Host your Plek
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Share your availability, host guests, and anoffer your own addons packages in a CID community.
          </p>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="mb-6">
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing...
              </div>
            ) : proProduct ? (
              <>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-[#020817]">
                    R{proProduct.price.toFixed(2)}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    / month
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Sparkles className="h-4 w-4 text-[#0891b2]" />
                  <span>
                    <strong>Package</strong> creation and management
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Includes {proProduct.periodCount} {proProduct.period}
                  {proProduct.periodCount > 1 ? 's' : ''} photography shoot
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Pro plan currently unavailable.</p>
            )}
          </div>

          <ul className="mb-8 flex-1 space-y-3 text-sm text-slate-600">
            {proProduct?.features && Array.isArray(proProduct.features) && proProduct.features.length > 0 ? (
              proProduct.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#0891b2]" />
                  <span>{typeof feature === 'string' ? feature : (feature as any).feature || feature}</span>
                </li>
              ))
            ) : (
              <>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#0891b2]" />
                  <span>Publish & manage masterclasses</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#0891b2]" />
                  <span>Annual access to garden events</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#0891b2]" />
                  <span>Pro-level revenue share entitlements</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-[#0891b2]" />
                  <span>Admin/Host upgrades unlocked</span>
                </li>
              </>
            )}
          </ul>

          <Button
            onClick={() => onSubscribe(proProduct)}
            disabled={!proProduct || paymentLoading}
            className="w-full bg-[#0891b2] text-white hover:bg-[#0e7490]"
          >
            {paymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {subscriptionStatus.isSubscribed &&
            subscriptionStatus.entitlements.some((entitlement) => entitlement.includes('pro'))
              ? 'Pro access active'
              : 'Upgrade to Pro with Yoco'}
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Includes 1 hour of photography shoot
          </p>
        </div>
      </motion.div>
    </div>
  )
}

