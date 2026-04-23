'use client'

import React, { useEffect, useState } from 'react'
import { User } from '@/payload-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, User as UserIcon, Crown, Calendar, FileText, Edit3, Loader2, AlertCircle, CheckCircle2, ArrowUpDown, Filter, Eye, Download, MoreHorizontal, CreditCard, Activity, Sparkles } from 'lucide-react'
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'
import { useSubscription } from '@/hooks/useSubscription'
import { EditPostsLink } from '@/components/EditPostsLink'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'
import { getGravatarUrl } from '@/utils/gravatar'
import { Gravatar } from '@/components/Gravatar'

function isPlaceholderMobileEmail(email?: string | null): boolean {
  return Boolean(email && email.endsWith('@phone.simpleplek.invalid'))
}

type YocoTransaction = {
  id: string
  packageName?: string
  status?: 'completed' | 'pending' | 'failed' | 'cancelled'
  amount?: number
  currency?: string
  createdAt?: string
  expiresAt?: string
  category?: string
}

type AvailableProduct = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  period: string
  periodCount: number
  category: string
  features: string[]
  entitlement: string
  icon?: string
}


interface AccountClientProps {
  user: User | null
}

export default function AccountClient({ user }: AccountClientProps) {
  const { isSubscribed, isLoading } = useSubscription()
  const [transactions, setTransactions] = useState<YocoTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [activeTransaction, setActiveTransaction] = useState<YocoTransaction | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [activeProducts, setActiveProducts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'features' | 'transactions' | 'activity'>('features')

  if (!user) return null
  const missingName = !user.name || String(user.name).trim().length === 0
  const missingEmail = !user.email || isPlaceholderMobileEmail(user.email)
  const missingMobile = !(user as any).mobile || !(user as any).mobileVerified
  const missingRequiredInfo = missingName || missingEmail || missingMobile

  useEffect(() => {
    const loadTransactions = async () => {
      if (!user) return
      setLoadingTransactions(true)
      try {
        const response = await fetch('/api/yoco/transactions', { credentials: 'include' })
        if (!response.ok) return
        const data = await response.json()
        const allTransactions = data.transactions || []
        setTransactions(allTransactions)
        const current = allTransactions.find((tx: YocoTransaction) => {
          if (tx.status !== 'completed') return false
          if (!tx.expiresAt) return true
          return new Date(tx.expiresAt) > new Date()
        })
        setActiveTransaction(current || null)
      } catch (error) {
        console.error('Failed to fetch Yoco transactions:', error)
      } finally {
        setLoadingTransactions(false)
      }
    }

    loadTransactions()
  }, [user])

  useEffect(() => {
    const loadProducts = async () => {
      if (!user) return
      setLoadingProducts(true)
      try {
        const response = await fetch('/api/packages/available-products', { credentials: 'include' })
        if (!response.ok) return
        const products = await response.json()
        setAvailableProducts(products || [])

        // Determine which products are active based on subscription
        const activeSet = new Set<string>()
        if (isSubscribed) {
          // Add products that match user's entitlement
          products.forEach((product: AvailableProduct) => {
            if (product.entitlement === 'standard' || product.entitlement === 'pro') {
              activeSet.add(product.id)
            }
          })
        }
        setActiveProducts(activeSet)
      } catch (error) {
        console.error('Failed to fetch available products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [user, isSubscribed])

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You need to be logged in to view this page.</p>
        </div>
      </div>
    )
  }

  const userRoles = Array.isArray(user.role) ? (user.role as string[]) : user.role ? [user.role] : []
  const isHost = userRoles.includes('host')
  const isAdmin = userRoles.includes('admin')
  const isCustomer = userRoles.includes('customer')

  // Infer subscription tier from transaction history
  const inferSubscriptionTier = (transactions: YocoTransaction[]): string => {
    const hasLuxuryBooking = transactions.some(t => (t.amount || 0) > 10000 && t.status === 'completed')
    const hasMultipleSubscriptions = transactions.filter(t => t.status === 'completed').length >= 2
    const totalSpent = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0)

    if (hasLuxuryBooking && totalSpent > 15000) return 'Premium'
    if (hasMultipleSubscriptions || totalSpent > 500) return 'Member'
    if (isSubscribed) return 'Member'
    return 'Basic'
  }

  const tier = inferSubscriptionTier(transactions)

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      } else {
        const amountA = a.amount || 0
        const amountB = b.amount || 0
        return sortOrder === 'asc' ? amountA - amountB : amountB - amountA
      }
    })

  const toggleSort = (column: 'date' | 'amount') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }


  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      failed: 'bg-red-500/10 text-red-700 border-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    }
    return styles[status] || styles.pending
  }

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      Premium: 'bg-primary/10 text-primary border-primary/20',
      Member: 'bg-secondary text-secondary-foreground border-transparent',
      Basic: 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    }
    return styles[tier] || styles.Basic
  }

  const getUserInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(' ').filter(Boolean)
      if (parts.length >= 2) {
        const first = parts[0]?.[0]
        const last = parts[parts.length - 1]?.[0]
        if (first && last) {
          return (first + last).toUpperCase()
        }
      }
      const firstChar = name[0]
      if (firstChar) {
        return firstChar.toUpperCase()
      }
    }
    if (email) {
      const firstChar = email[0]
      if (firstChar) {
        return firstChar.toUpperCase()
      }
    }
    return 'U'
  }

  const handleCancelMembership = async () => {
    if (!activeTransaction) return
    setCancelLoading(true)
    setCancelError(null)
    setCancelSuccess(null)
    try {
      const response = await fetch('/api/yoco/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ transactionId: activeTransaction.id }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to cancel membership')
      }
      setCancelSuccess('Membership cancellation requested. Access will be downgraded shortly.')
      setActiveTransaction(null)
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === activeTransaction.id
            ? { ...tx, status: 'cancelled', expiresAt: tx.expiresAt || new Date().toISOString() }
            : tx,
        ),
      )
      window.dispatchEvent(new Event('yoco:subscription-updated'))
    } catch (error) {
      console.error('Failed to cancel membership:', error)
      setCancelError(error instanceof Error ? error.message : 'Failed to cancel membership.')
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-primary/20 bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Account</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your account and access your features
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Gravatar
                email={user.email}
                size={40}
                alt={user.name || 'User'}
                className="h-10 w-10 rounded-full border-2 border-primary object-cover shadow-sm"
                fallback={
                  <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground text-sm font-semibold rounded-full shadow-sm">
                    {getUserInitials(user.name, user.email)}
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="border-b border-primary/20 bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center bg-primary rounded-xl mb-4 shadow-sm">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              AI Assistant
            </h2>
            <p className="text-muted-foreground">
              Ask anything about your bookings, payments, or account features
            </p>
          </div>

          <PageAIAssistant
            context={{
              type: 'account',
              data: {
                transactions,
                products: availableProducts,
              },
            }}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-primary/20 bg-card">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-8">
            {[
              {
                id: 'features' as const,
                label: 'Features',
                icon: Settings,
              },
              {
                id: 'transactions' as const,
                label: 'Transactions',
                icon: CreditCard,
              },
              {
                id: 'activity' as const,
                label: 'Quick Actions',
                icon: Activity,
              },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-primary'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === 'features' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Account Info Card */}
              <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Account Information
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your profile and subscription details
                    </p>
                  </div>
                  <div className={`inline-flex items-center text-xs font-medium border rounded-full px-3 py-1 ${getTierBadge(tier)}`}>
                    {tier} Tier
                  </div>
                </div>

                {missingRequiredInfo && (
                  <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-medium">Action required: complete your profile</div>
                    <div className="mt-1 text-amber-800">
                      We need your{' '}
                      {[
                        missingName ? 'name' : null,
                        missingEmail ? 'email' : null,
                        missingMobile ? 'verified mobile number' : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}{' '}
                      to meet legal requirements.
                    </div>
                    <div className="mt-3">
                      <Link href={`/onboarding/profile?next=${encodeURIComponent('/account')}`}>
                        <Button size="sm" variant="secondary">
                          Complete profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pb-6 border-b border-primary/10">
                  <Gravatar
                    email={user.email}
                    size={64}
                    alt={user.name || 'User'}
                    className="h-16 w-16 rounded-full border-2 border-primary object-cover shadow-sm"
                    fallback={
                      <div className="flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground text-xl font-semibold rounded-full shadow-sm">
                        {getUserInitials(user.name, user.email)}
                      </div>
                    }
                  />
                  <div>
                    <div className="font-medium text-foreground">{user.name || 'No name set'}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {(user as any).mobile ? (user as any).mobile : 'No mobile set'}{' '}
                      <span className="text-xs">
                        {(user as any).mobileVerified ? '(verified)' : '(not verified)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {userRoles.map((role) => (
                        <div
                          key={role}
                          className={`flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${role === 'admin'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : role === 'host'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-secondary/10 text-secondary border-secondary/20'
                            }`}
                        >
                          {role === 'admin' && <Crown className="mr-1 h-3 w-3" />}
                          {role === 'host' && <Crown className="mr-1 h-3 w-3" />}
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  {isSubscribed && activeTransaction ? (
                    <Button
                      variant="destructive"
                      onClick={handleCancelMembership}
                      disabled={cancelLoading}
                      className="w-full"
                    >
                      {cancelLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Subscription'
                      )}
                    </Button>
                  ) : (
                    <Link href="/subscribe" className="block">
                      <Button variant="secondary" className="w-full">
                        Manage Subscription
                      </Button>
                    </Link>
                  )}
                  {cancelError && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{cancelError}</span>
                    </div>
                  )}
                  {cancelSuccess && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-secondary/10 p-2 text-xs text-secondary">
                      <CheckCircle2 className="mt-0.5 h-4 w-4" />
                      <span>{cancelSuccess}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Available Packages */}
              <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Available Packages
                </h3>
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading packages...</span>
                  </div>
                ) : availableProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No packages available.</p>
                ) : (
                  <div className="space-y-3">
                    {availableProducts.map((product) => {
                      const isActive = activeProducts.has(product.id)
                      const canToggle = isSubscribed || product.entitlement === 'none'

                      return (
                        <div
                          key={product.id}
                          className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${isActive
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-primary/20 bg-background hover:bg-secondary/5'
                            }`}
                        >
                          <div className="flex items-start gap-4 flex-1">
                            {product.icon && (
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-2xl ${isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-secondary/10 text-secondary'
                                }`}>
                                {product.icon}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'
                                  }`}>
                                  {product.title}
                                </h4>
                                {product.entitlement && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${product.entitlement === 'pro'
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : product.entitlement === 'standard'
                                        ? 'bg-secondary/10 text-secondary border border-secondary/20'
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {product.entitlement}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {product.description}
                              </p>
                              {product.features && product.features.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {product.features.slice(0, 3).map((feature, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-2 py-0.5 rounded bg-secondary/10 text-secondary"
                                    >
                                      {feature}
                                    </span>
                                  ))}
                                  {product.features.length > 3 && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                      +{product.features.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>
                                  {product.currency} {product.price.toFixed(2)}
                                </span>
                                {product.period && (
                                  <span>
                                    / {product.periodCount} {product.period}
                                    {product.periodCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            {canToggle ? (
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setActiveProducts(prev => new Set(prev).add(product.id))
                                    // TODO: Handle subscription activation
                                  } else {
                                    setActiveProducts(prev => {
                                      const next = new Set(prev)
                                      next.delete(product.id)
                                      return next
                                    })
                                    // TODO: Handle subscription deactivation
                                  }
                                }}
                                disabled={!canToggle}
                              />
                            ) : (
                              <Link href="/subscribe" className="no-underline">
                                <button className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm">
                                  Subscribe
                                </button>
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Resources
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      label: 'Documentation',
                      href: '#',
                    },
                    {
                      label: 'API Reference',
                      href: '#',
                    },
                    {
                      label: 'Support Center',
                      href: '#',
                    },
                    {
                      label: 'FAQ',
                      href: '/faq',
                    },
                    {
                      label: 'Community',
                      href: '#',
                    },
                  ].map((link, idx) => (
                    <Link
                      key={idx}
                      href={link.href}
                      className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-card border border-primary/20 rounded-xl shadow-sm">
            <div className="p-6 border-b border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Transaction History
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    View and manage your payment history
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`flex items-center gap-1.5 h-9 text-xs font-medium rounded-lg px-3 transition-colors ${statusFilter === 'all'
                        ? 'text-primary-foreground bg-primary'
                        : 'text-foreground bg-background border border-primary/20 hover:bg-secondary/10'
                      }`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`h-9 text-xs font-medium rounded-lg px-3 transition-colors ${statusFilter === 'completed'
                        ? 'text-primary-foreground bg-primary'
                        : 'text-foreground bg-background border border-primary/20 hover:bg-secondary/10'
                      }`}
                  >
                    Completed
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`h-9 text-xs font-medium rounded-lg px-3 transition-colors ${statusFilter === 'pending'
                        ? 'text-primary-foreground bg-primary'
                        : 'text-foreground bg-background border border-primary/20 hover:bg-secondary/10'
                      }`}
                  >
                    Pending
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/10 border-b border-primary/20">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                      Description
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                      <button
                        onClick={() => toggleSort('date')}
                        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Date <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                      <button
                        onClick={() => toggleSort('amount')}
                        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Amount <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="hover:bg-secondary/5 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-foreground">
                            {transaction.packageName || 'Subscription payment'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {transaction.category || 'Payment'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {transaction.createdAt
                            ? new Date(transaction.createdAt).toLocaleDateString('en-GB')
                            : 'Unknown date'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {transaction.currency || 'ZAR'} {transaction.amount?.toFixed(2) ?? '0.00'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 ${transaction.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : transaction.status === 'completed'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-muted text-muted-foreground border border-primary/20'
                              }`}
                          >
                            {transaction.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/10 rounded-lg transition-colors">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/10 rounded-lg transition-colors">
                              <Download className="h-4 w-4" />
                            </button>
                            <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/10 rounded-lg transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-primary/20 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </p>
              <Link
                href="/subscribe"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View all transactions →
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading packages...</span>
              </div>
            ) : availableProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No packages available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableProducts
                  .filter((product) => product.category !== 'addon')
                  .slice(0, 4)
                  .map((product) => {
                    const isActive = activeProducts.has(product.id)
                    const canToggle = isSubscribed || product.entitlement === 'none'

                    return (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between p-6 bg-card border rounded-xl transition-all shadow-sm ${isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-primary/20 hover:border-primary/40 hover:shadow-md'
                          }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {product.icon && (
                            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isActive
                                ? 'bg-primary/10 text-primary'
                                : 'bg-secondary/10 text-secondary'
                              } text-2xl`}>
                              {product.icon}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'
                                }`}>
                                {product.title}
                              </h4>
                              {product.entitlement && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${product.entitlement === 'pro'
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : product.entitlement === 'standard'
                                      ? 'bg-secondary/10 text-secondary border border-secondary/20'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                  {product.entitlement}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {product.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>
                                {product.currency} {product.price.toFixed(2)}
                              </span>
                              {product.period && (
                                <span>
                                  / {product.periodCount} {product.period}
                                  {product.periodCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          {canToggle ? (
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setActiveProducts(prev => new Set(prev).add(product.id))
                                  // TODO: Handle subscription activation
                                } else {
                                  setActiveProducts(prev => {
                                    const next = new Set(prev)
                                    next.delete(product.id)
                                    return next
                                  })
                                  // TODO: Handle subscription deactivation
                                }
                              }}
                              disabled={!canToggle}
                            />
                          ) : (
                            <Link href="/subscribe" className="no-underline">
                              <button className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm">
                                Subscribe
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
