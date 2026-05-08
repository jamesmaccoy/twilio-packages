'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Plane, Calendar, Coins, QrCode, Ticket } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { useUserContext } from '@/context/UserContext'
import { useYoco } from '@/providers/Yoco'
import { useSubscription } from '@/hooks/useSubscription'
import type { YocoProduct } from '@/lib/yocoService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentPreview } from '@/components/subscribe/ContentPreview'
import { PricingSection } from '@/components/subscribe/PricingSection'
import { TransactionFeed, type Transaction } from '@/components/subscribe/TransactionFeed'
import { NotificationToast } from '@/components/subscribe/NotificationToast'
import { validateRedirect } from '@/utils/validateRedirect'

type YocoTransaction = {
  id: string
  intent: 'booking' | 'subscription' | 'product'
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  packageName?: string
  amount?: number
  currency?: string
  entitlement?: 'none' | 'standard' | 'pro'
  plan?: 'free' | 'standard' | 'pro'
  createdAt?: string
  completedAt?: string
  expiresAt?: string
  paymentUrl?: string
}

type TokenUsageSummary = {
  total: number | null
  prompt: number | null
  candidates: number | null
  cached: number | null
  thoughts: number | null
  timestamp: number
}

const periodToDays = (product: YocoProduct) => {
  switch (product.period) {
    case 'day':
      return product.periodCount
    case 'week':
      return product.periodCount * 7
    case 'month':
      return product.periodCount * 30
    case 'year':
      return product.periodCount * 365
    default:
      return 30
  }
}

export default function SubscribePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useUserContext()
  const { createPaymentLink, isInitialized } = useYoco()
  const subscriptionStatus = useSubscription()
  const next = validateRedirect(searchParams.get('next')) || '/bookings'

  const [products, setProducts] = useState<YocoProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [transactions, setTransactions] = useState<YocoTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [latestTokenUsage, setLatestTokenUsage] = useState<TokenUsageSummary | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/yoco/products', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to load products')
      }
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      console.error('Failed to fetch Yoco products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    if (!currentUser) return
    setLoadingTransactions(true)
    try {
      const response = await fetch('/api/yoco/transactions', { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Failed to load transactions')
      }
      const data = await response.json()
      setTransactions(data.transactions || [])
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
    } finally {
      setLoadingTransactions(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (isInitialized) {
      fetchProducts()
      fetchTransactions()
    }
  }, [fetchProducts, fetchTransactions, isInitialized])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isSuccess = params.get('success') === 'true'
    const transactionId = params.get('transactionId')

    const finalize = async () => {
      if (isSuccess && transactionId) {
        try {
          const response = await fetch('/api/yoco/transactions/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ transactionId }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to confirm transaction')
          }

          setSuccessMessage('Payment confirmed. Your subscription has been updated.')
          fetchTransactions()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('yoco:subscription-updated'))
          }
        } catch (err) {
          console.error('Failed to confirm transaction:', err)
          setError(err instanceof Error ? err.message : 'Failed to confirm payment')
        } finally {
          router.replace(`/subscribe?next=${encodeURIComponent(next)}`)
        }
      }
    }

    finalize()
  }, [fetchTransactions, next, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const readStoredUsage = (): TokenUsageSummary | null => {
      try {
        const stored = window.localStorage.getItem('ai:lastTokenUsage')
        if (!stored) return null
        const parsed = JSON.parse(stored)
        if (!parsed || typeof parsed !== 'object') return null
        return parsed as TokenUsageSummary
      } catch (storageError) {
        console.warn('Failed to load stored AI token usage', storageError)
        return null
      }
    }

    const initialUsage = readStoredUsage()
    if (initialUsage) {
      setLatestTokenUsage(initialUsage)
    }

    const handleTokenUsage = (event: Event) => {
      const customEvent = event as CustomEvent<TokenUsageSummary>
      if (customEvent.detail) {
        setLatestTokenUsage(customEvent.detail)
      }
    }

    window.addEventListener('aiTokenUsage', handleTokenUsage as EventListener)

    return () => {
      window.removeEventListener('aiTokenUsage', handleTokenUsage as EventListener)
    }
  }, [])

  const standardProduct = useMemo(
    () => products.find((product) => product.entitlement !== 'pro'),
    [products],
  )

  const proProduct = useMemo(
    () => products.find((product) => product.entitlement === 'pro'),
    [products],
  )

  const handleSubscribe = useCallback(
    async (product: YocoProduct | undefined) => {
      if (!product || paymentLoading) return
      if (!currentUser) {
        router.push('/login?redirect=/subscribe')
        return
      }

      setPaymentLoading(true)
      setError(null)
      setSuccessMessage(null)

      try {
        const metadata = {
          intent: 'subscription' as const,
          entitlement: (product.entitlement as 'pro' | 'standard' | 'none') || 'none',
          plan: (product.entitlement === 'pro' ? 'pro' : 'standard') as 'pro' | 'standard',
          periodDays: periodToDays(product),
        }

        const paymentLink = await createPaymentLink(product.id, currentUser.name || currentUser.email || undefined, metadata)

        if (!paymentLink?.url) {
          throw new Error('Unable to start checkout')
        }

        window.location.href = paymentLink.url
      } catch (err) {
        console.error('Error creating payment link:', err)
        setError(err instanceof Error ? err.message : 'Failed to create payment link')
      } finally {
        setPaymentLoading(false)
      }
    },
    [createPaymentLink, currentUser, paymentLoading, router],
  )

  const activeSubscriptionBadge = subscriptionStatus.isSubscribed ? (
    <Badge className="bg-green-100 text-green-800 border-transparent">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200">Inactive</Badge>
  )

  // Transform transactions for TransactionFeed component
  const transformedTransactions: Transaction[] = transactions.map((tx) => ({
    id: tx.id,
    createdAt: tx.createdAt,
    packageName: tx.packageName,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    plan: tx.plan,
    entitlement: tx.entitlement,
    expiresAt: tx.expiresAt,
    paymentUrl: tx.paymentUrl,
  }))

  // Get latest pending transaction for notification
  const latestPendingTransaction = transactions.find((tx) => tx.status === 'pending')

  // Get active subscription transaction for boarding pass
  const activeTransaction = transactions.find((tx) => {
    if (!tx || tx.status !== 'completed' || tx.intent !== 'subscription') return false
    if (!tx.expiresAt) return true
    return new Date(tx.expiresAt) > new Date()
  })

  // Countdown timer for redirect
  useEffect(() => {
    if (!subscriptionStatus.isSubscribed) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsRedirecting(true)
          setTimeout(() => {
            router.push(next)
          }, 800)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [next, subscriptionStatus.isSubscribed, router])

  if (!isInitialized || subscriptionStatus.isLoading) {
    return (
      <div className="container py-16">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading subscription data...
        </div>
      </div>
    )
  }

  if (subscriptionStatus.isSubscribed) {
    const validFrom = activeTransaction?.completedAt 
      ? format(new Date(activeTransaction.completedAt), 'MMM d, yyyy')
      : activeTransaction?.createdAt
      ? format(new Date(activeTransaction.createdAt), 'MMM d, yyyy')
      : 'Active'
    
    const validUntil = subscriptionStatus.expirationDate
      ? format(subscriptionStatus.expirationDate, 'MMM d, yyyy')
      : activeTransaction?.expiresAt
      ? format(new Date(activeTransaction.expiresAt), 'MMM d, yyyy')
      : 'Ongoing'

    const isPro = subscriptionStatus.entitlements.some((entitlement) => entitlement.includes('pro'))
    const tokenBalance = latestTokenUsage?.total ?? 0

    return (
      <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-4 font-[GeistSans] text-gray-900 overflow-hidden relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-teal-200/20 rounded-full blur-3xl" />
          <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-cyan-200/20 rounded-full blur-3xl" />
        </div>

        <AnimatePresence mode="wait">
          {!isRedirecting ? (
            <motion.div
              key="boarding-pass"
              initial={{
                y: 50,
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                y: 0,
                opacity: 1,
                scale: 1,
              }}
              exit={{
                y: -100,
                opacity: 0,
                scale: 0.95,
                transition: {
                  duration: 0.5,
                  ease: 'backIn',
                },
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className="w-full max-w-md relative drop-shadow-2xl"
            >
              {/* Ticket Container */}
              <div className="bg-white rounded-3xl overflow-hidden relative">
                {/* Top Section: Header & Status */}
                <div className="bg-teal-500 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Plane size={120} strokeWidth={1} />
                  </div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium tracking-wider uppercase">
                      <CheckCircle2 size={14} />
                      <span>Active</span>
                    </div>
                    <div className="text-right">
                      <p className="text-teal-100 text-xs font-mono uppercase tracking-widest">
                        Class
                      </p>
                      <p className="font-bold text-lg">{isPro ? 'PRO' : 'STANDARD'}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h1 className="text-3xl font-bold tracking-tight">
                      Simple Plek
                    </h1>
                    <p className="text-teal-100 text-sm mt-1">
                      Global Membership Access
                    </p>
                  </div>
                </div>

                {/* Middle Section: Details */}
                <div className="p-6 pb-8 space-y-6">
                  {/* Token Balance - Prominent */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between group">
                    <div>
                      <p className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">
                        Token Balance
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          {typeof tokenBalance === 'number' ? tokenBalance.toLocaleString() : '—'}
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                          TKN
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Coins size={24} />
                    </div>
                  </div>

                  {/* Flight/Membership Details Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Calendar size={14} />
                        <span className="text-xs font-mono uppercase tracking-wider">
                          Valid From
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{validFrom}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Calendar size={14} />
                        <span className="text-xs font-mono uppercase tracking-wider">
                          Valid Until
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{validUntil}</p>
                    </div>
                  </div>
                </div>

                {/* Perforation / Cutout Line */}
                <div className="relative h-8 bg-white flex items-center">
                  <div className="absolute left-0 w-8 h-8 bg-gray-100 rounded-full -translate-x-1/2" />
                  <div className="w-full border-b-2 border-dashed border-gray-200 mx-4" />
                  <div className="absolute right-0 w-8 h-8 bg-gray-100 rounded-full translate-x-1/2" />
                </div>

                {/* Bottom Section: Stub / Redirect */}
                <div className="p-6 bg-gray-50 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-gray-400 font-mono uppercase">
                      Boarding in
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-teal-600 tabular-nums">
                        00:0{countdown}
                      </span>
                      <span className="text-xs text-gray-400">seconds</span>
                    </div>
                  </div>

                  {/* Barcode Visual */}
                  <div className="h-12 flex items-center gap-1 opacity-60 mix-blend-multiply">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-full bg-gray-800 ${i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-2' : 'w-0.5'}`}
                      />
                    ))}
                    <QrCode className="ml-2 text-gray-800" size={40} />
                  </div>
                </div>

                {/* Progress Bar at bottom */}
                <motion.div
                  className="h-1 bg-teal-500 absolute bottom-0 left-0"
                  initial={{
                    width: '0%',
                  }}
                  animate={{
                    width: '100%',
                  }}
                  transition={{
                    duration: 5,
                    ease: 'linear',
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="redirecting"
              initial={{
                opacity: 0,
                scale: 0.9,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6">
                <motion.div
                  animate={{
                    rotate: 360,
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Ticket className="text-teal-500" size={32} />
                </motion.div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Taking you to your account...
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-white font-[GeistSans] text-[#020817]">
      <NotificationToast transaction={latestPendingTransaction} />

      <div className="mx-auto max-w-[1376px] px-4 py-16 sm:px-8 sm:py-24">
        {/* Header Section */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Badge className="mb-6 bg-slate-100 text-slate-600 border-slate-200">
            Secure Payments by Yoco
          </Badge>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-[#020817] sm:text-5xl">
            Choose your Simple Plek access
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-slate-500">
            Unlock curated spaces, community events, and pro hosting features.
            Join the garden community today.
          </p>

          <div className="flex items-center justify-center gap-3 text-sm text-slate-600">
            <span>Subscription status:</span>
            {activeSubscriptionBadge}
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="mx-auto mb-8 max-w-2xl rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Something went wrong</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mx-auto mb-8 max-w-2xl rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {/* Content Preview (Privacy/Teaser) */}
        <div className="mx-auto mb-16 max-w-4xl">
          <div className="mb-4 flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Member Exclusive Content
            </h2>
            <span className="text-xs text-slate-400">Preview</span>
          </div>
          <ContentPreview />
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto mb-20 max-w-5xl">
          <PricingSection
            standardProduct={standardProduct}
            proProduct={proProduct}
            loadingProducts={loadingProducts}
            paymentLoading={paymentLoading}
            latestTokenUsage={latestTokenUsage}
            subscriptionStatus={subscriptionStatus}
            onSubscribe={handleSubscribe}
          />
        </div>

        {/* Transaction Feed */}
        <div className="mx-auto max-w-4xl rounded-xl bg-slate-50 p-6 sm:p-8">
          <TransactionFeed transactions={transformedTransactions} loading={loadingTransactions} />
        </div>
      </div>
    </div>
  )
}