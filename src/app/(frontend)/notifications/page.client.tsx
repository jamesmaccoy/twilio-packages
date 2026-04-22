'use client'

import { useState, useEffect, useMemo } from 'react'
import { YocoTransaction, User } from '@/payload-types'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { 
  Calendar, 
  Package, 
  CreditCard, 
  RefreshCw, 
  BellOff,
  ExternalLink,
  History,
  Coins,
  TrendingUp,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/utilities/cn'

type Props = {
  initialNotifications: YocoTransaction[]
  user: User
}

type FilterType = 'all' | 'bookings' | 'payments' | 'tokens'

// Map notification types to transaction types for filtering
const getTransactionType = (notificationType: string): 'booking' | 'payment' | 'reschedule' | 'addon' | 'other' => {
  if (['booking_created', 'booking_updated', 'booking_cancelled'].includes(notificationType)) {
    return 'booking'
  }
  if (notificationType === 'booking_rescheduled') {
    return 'reschedule'
  }
  if (notificationType === 'addon_purchased') {
    return 'addon'
  }
  if (notificationType === 'payment_received') {
    return 'payment'
  }
  return 'other'
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'booking_created':
    case 'booking_updated':
    case 'booking_cancelled':
      return Calendar
    case 'payment_received':
      return CreditCard
    case 'booking_rescheduled':
      return RefreshCw
    case 'addon_purchased':
      return Package
    default:
      return Clock
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'booking_created':
    case 'booking_updated':
    case 'booking_cancelled':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'payment_received':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'booking_rescheduled':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'addon_purchased':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function NotificationsClient({ initialNotifications, user }: Props) {
  const [notifications, setNotifications] = useState<YocoTransaction[]>(initialNotifications)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set())
  const [versionHistory, setVersionHistory] = useState<Record<string, any[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())
  const [activeBookings, setActiveBookings] = useState(0)
  const [latestTokenUsage, setLatestTokenUsage] = useState<{
    total: number | null
    prompt: number | null
    candidates: number | null
    cached: number | null
    thoughts: number | null
    timestamp?: number
  } | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
    // Fetch active bookings count
    fetch('/api/bookings?type=upcoming')
      .then((res) => res.json())
      .then((data) => setActiveBookings(data.bookings?.length || 0))
      .catch((err) => console.error('Error fetching bookings:', err))

    // Load token usage from localStorage
    if (typeof window !== 'undefined') {
      const readStoredUsage = () => {
        try {
          const stored = window.localStorage.getItem('ai:lastTokenUsage')
          if (!stored) return null
          const parsed = JSON.parse(stored)
          if (!parsed || typeof parsed !== 'object') return null
          return parsed
        } catch (error) {
          console.warn('Failed to load stored AI token usage', error)
          return null
        }
      }

      const initialUsage = readStoredUsage()
      if (initialUsage) {
        setLatestTokenUsage(initialUsage)
      }

      const handleTokenUsage = (event: Event) => {
        const customEvent = event as CustomEvent<typeof latestTokenUsage>
        if (customEvent.detail) {
          setLatestTokenUsage(customEvent.detail)
        }
      }

      window.addEventListener('aiTokenUsage', handleTokenUsage as EventListener)

      return () => {
        window.removeEventListener('aiTokenUsage', handleTokenUsage as EventListener)
      }
    }
  }, [])

  // Calculate stats from notifications
  const stats = useMemo(() => {
    // Calculate total spent from payment notifications
    const paymentNotifications = notifications.filter(
      (n) => n.type === 'payment_received' && n.amount
    )
    const totalSpent = paymentNotifications.reduce((sum, n) => sum + (n.amount || 0), 0)

    // Calculate monthly activity (notifications from last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const monthlyActivity = notifications.filter(
      (n) => n.createdAt && new Date(n.createdAt) >= thirtyDaysAgo
    ).length

    // Get token balance from localStorage (AI usage tokens)
    const tokenBalance = latestTokenUsage?.total ?? 0

    // Calculate token change from this month's notifications with token metadata
    const monthlyNotifications = notifications.filter(
      (n) => n.createdAt && new Date(n.createdAt) >= thirtyDaysAgo
    )
    const tokenChange = monthlyNotifications.reduce((sum, n) => {
      const metadata = n.metadata as any
      if (metadata?.tokens && typeof metadata.tokens === 'number') {
        return sum + metadata.tokens
      }
      return sum
    }, 0)

    return {
      activeBookings,
      totalSpent,
      monthlyActivity,
      tokenBalance,
      tokenChange,
    }
  }, [notifications, activeBookings, latestTokenUsage])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/notifications?limit=100`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }


  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, read: true }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) =>
            fetch('/api/notifications', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationId: n.id, read: true }),
            })
          )
      )
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  // Filter notifications based on selected filter and search query
  const filteredNotifications = notifications.filter((n) => {
    // Filter by type
    if (filter === 'bookings' && !['booking_created', 'booking_updated', 'booking_cancelled', 'booking_rescheduled'].includes(n.type || '')) {
      return false
    }
    if (filter === 'payments' && n.type !== 'payment_received') {
      return false
    }
    if (filter === 'tokens') {
      // Show notifications with token changes (if metadata has tokens field)
      const metadata = n.metadata as any
      if (!metadata?.tokens) return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = n.title?.toLowerCase().includes(query)
      const matchesDescription = n.description?.toLowerCase().includes(query)
      const matchesPackage = n.packageName?.toLowerCase().includes(query)
      const metadata = n.metadata as any
      const matchesProperty = metadata?.propertyTitle?.toLowerCase().includes(query)
      
      if (!matchesTitle && !matchesDescription && !matchesPackage && !matchesProperty) {
        return false
      }
    }

    return true
  })

  const handleNotificationClick = (notification: YocoTransaction) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const toggleVersionHistory = async (notification: YocoTransaction) => {
    const notificationId = notification.id
    const isExpanded = expandedNotifications.has(notificationId)
    
    if (isExpanded) {
      // Collapse
      setExpandedNotifications((prev) => {
        const next = new Set(prev)
        next.delete(notificationId)
        return next
      })
    } else {
      // Expand and load version history
      setExpandedNotifications((prev) => new Set(prev).add(notificationId))
      
      // Load version history if not already loaded
      if (!versionHistory[notificationId]) {
        setLoadingVersions((prev) => new Set(prev).add(notificationId))
        
        try {
          let versions: any[] = []
          
          if (notification.relatedBooking) {
            const bookingId = typeof notification.relatedBooking === 'string' 
              ? notification.relatedBooking 
              : notification.relatedBooking.id
            
            const response = await fetch(`/api/bookings/${bookingId}/versions`)
            if (response.ok) {
              const data = await response.json()
              versions = data.versions || []
            }
          } else if (notification.relatedTransaction || notification.id) {
            // For merged collection, use the notification's own ID for version history
            const transactionId = notification.relatedTransaction
              ? (typeof notification.relatedTransaction === 'string'
                  ? notification.relatedTransaction
                  : notification.relatedTransaction.id)
              : notification.id
            
            const response = await fetch(`/api/transactions/${transactionId}/versions`)
            if (response.ok) {
              const data = await response.json()
              versions = data.versions || []
            }
          }
          
          setVersionHistory((prev) => ({
            ...prev,
            [notificationId]: versions,
          }))
        } catch (error) {
          console.error('Error loading version history:', error)
        } finally {
          setLoadingVersions((prev) => {
            const next = new Set(prev)
            next.delete(notificationId)
            return next
          })
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-primary-600">
              simpleplek curreny
            </span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Activity Timeline
          </h1>
          <p className="text-slate-600">
            Your bookings, payments, and token transactions in one place
          </p>
        </div>

        {/* Token Balance Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="md:col-span-2 bg-gradient-to-br from-primary to-secondary rounded-2xl p-8 text-white shadow-xl" style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-5 w-5 opacity-90" />
                  <span className="text-primary-foreground/90 text-sm font-medium">
                    Token Balance
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-bold tracking-tight">
                    {stats.tokenBalance.toLocaleString()}
                  </span>
                  <span className="text-2xl font-semibold text-primary-foreground/90">
                    tokens
                  </span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <div className="flex items-center gap-1.5">
                  {stats.tokenChange > 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="font-semibold">
                    {stats.tokenChange > 0 ? '+' : ''}
                    {stats.tokenChange}
                  </span>
                </div>
                <span className="text-xs text-primary-foreground/90">this month</span>
              </div>
            </div>
            <div className="flex items-center gap-6 pt-6 border-t border-white/20">
              <div>
                <div className="text-3xl font-bold mb-1">{stats.monthlyActivity}</div>
                <div className="text-sm text-primary-foreground/90">Transactions</div>
              </div>
              <div className="h-12 w-px bg-white/20"></div>
              <div>
                <div className="text-sm text-primary-foreground/90 mb-1">
                  Next reward at
                </div>
                <div className="text-lg font-semibold">3,000 tokens</div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{stats.activeBookings}</div>
                  <div className="text-sm text-slate-600">Active Bookings</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    R{Math.round(stats.totalSpent / 1000)}K
                  </div>
                  <div className="text-sm text-slate-600">Total Spent</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Card */}
        {unreadCount > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">
                  Smart Insight
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}. 
                  {stats.activeBookings > 0 && ` You have ${stats.activeBookings} active booking${stats.activeBookings !== 1 ? 's' : ''} coming up.`}
                  {stats.tokenBalance > 0 && ` Your token balance is healthy—keep earning! 🎉`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'all' 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Activity
                </button>
                <button
                  onClick={() => setFilter('bookings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'bookings' 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Bookings
                </button>
                <button
                  onClick={() => setFilter('payments')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'payments' 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Payments
                </button>
                <button
                  onClick={() => setFilter('tokens')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'tokens' 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Token Changes
                </button>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Transaction Timeline */}
          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <BellOff className="h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-600">
                  {searchQuery ? 'No notifications match your search' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification, index) => {
                const metadata = notification.metadata as any
                const Icon = getTypeIcon(notification.type || '')
                const isNew = !notification.read
                const transactionType = getTransactionType(notification.type || '')
                const tokens = metadata?.tokens

                return (
                  <div
                    key={notification.id}
                    className={`p-6 transition-all hover:bg-slate-50 ${isNew ? 'bg-blue-50/30' : ''}`}
                    style={{
                      animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Timeline indicator */}
                      <div className="relative">
                        <div
                          className={cn(
                            'p-2.5 rounded-xl border-2',
                            getTypeColor(notification.type || '')
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        {index < filteredNotifications.length - 1 && (
                          <div className="absolute left-1/2 top-full -translate-x-1/2 w-0.5 h-6 bg-slate-200"></div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900">
                                {notification.title || 'Notification'}
                              </h3>
                              {isNew && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">
                              {notification.description || ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-slate-500 mb-1">
                              {mounted && notification.createdAt 
                                ? format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')
                                : notification.createdAt 
                                  ? new Date(notification.createdAt).toLocaleDateString()
                                  : 'Unknown date'}
                            </div>
                            {tokens && (
                              <div
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold',
                                  tokens > 0 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : 'bg-red-50 text-red-700'
                                )}
                              >
                                {tokens > 0 ? '+' : ''}
                                {tokens}
                                <Coins className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transaction Details */}
                        {(metadata || notification.packageName || notification.amount) && (
                          <div className="mt-3 p-4 bg-slate-50 rounded-lg space-y-2">
                            {metadata?.propertyTitle && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 min-w-20">Property:</span>
                                <span className="font-medium text-slate-900">
                                  {metadata.propertyTitle}
                                </span>
                              </div>
                            )}
                            {metadata?.fromDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 min-w-20">Dates:</span>
                                <span className="font-medium text-slate-900">
                                  {format(new Date(metadata.fromDate), 'MMM d, yyyy')}
                                  {metadata.toDate && ` - ${format(new Date(metadata.toDate), 'MMM d, yyyy')}`}
                                </span>
                              </div>
                            )}
                            {notification.packageName && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 min-w-20">Package:</span>
                                <span className="font-medium text-slate-900">
                                  {notification.packageName}
                                </span>
                              </div>
                            )}
                            {(notification.amount || metadata?.amount) && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500 min-w-20">Amount:</span>
                                <span className="font-medium text-slate-900">
                                  R{((notification.amount || metadata?.amount) || 0).toLocaleString()}
                                </span>
                              </div>
                            )}

                            {/* Change details for reschedules */}
                            {metadata?.changes && Object.keys(metadata.changes).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="text-xs font-semibold text-slate-500 mb-2">
                                  Changes:
                                </div>
                                {metadata.changes.fromDate && (
                                  <div className="flex items-center gap-2 text-sm mb-1">
                                    <span className="text-slate-500">Check-in:</span>
                                    <span className="text-slate-400 line-through">
                                      {format(new Date(metadata.changes.fromDate.from), 'MMM d, yyyy')}
                                    </span>
                                    <span className="text-amber-500">→</span>
                                    <span className="font-medium text-slate-900">
                                      {format(new Date(metadata.changes.fromDate.to), 'MMM d, yyyy')}
                                    </span>
                                  </div>
                                )}
                                {metadata.changes.toDate && (
                                  <div className="flex items-center gap-2 text-sm mb-1">
                                    <span className="text-slate-500">Check-out:</span>
                                    <span className="text-slate-400 line-through">
                                      {format(new Date(metadata.changes.toDate.from), 'MMM d, yyyy')}
                                    </span>
                                    <span className="text-amber-500">→</span>
                                    <span className="font-medium text-slate-900">
                                      {format(new Date(metadata.changes.toDate.to), 'MMM d, yyyy')}
                                    </span>
                                  </div>
                                )}
                                {metadata.changes.paymentStatus && (
                                  <div className="flex items-center gap-2 text-sm mb-1">
                                    <span className="text-slate-500">Payment:</span>
                                    <span className="text-slate-400 line-through">
                                      {metadata.changes.paymentStatus.from}
                                    </span>
                                    <span className="text-amber-500">→</span>
                                    <span className="font-medium text-slate-900">
                                      {metadata.changes.paymentStatus.to}
                                    </span>
                                  </div>
                                )}
                                {metadata.changes.total && (
                                  <div className="flex items-center gap-2 text-sm mb-1">
                                    <span className="text-slate-500">Total:</span>
                                    <span className="text-slate-400 line-through">
                                      R{metadata.changes.total.from?.toLocaleString() || '0'}
                                    </span>
                                    <span className="text-amber-500">→</span>
                                    <span className="font-medium text-slate-900">
                                      R{metadata.changes.total.to?.toLocaleString() || '0'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex items-center gap-3">
                          {notification.actionUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNotificationClick(notification)
                              }}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                            >
                              View Details
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(notification.relatedBooking || notification.relatedTransaction) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleVersionHistory(notification)
                              }}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                            >
                              <History className="h-3.5 w-3.5" />
                              History
                            </button>
                          )}
                        </div>

                        {/* Version History Timeline */}
                        {expandedNotifications.has(notification.id) && (
                          <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50/50 rounded-lg p-4">
                            {loadingVersions.has(notification.id) ? (
                              <div className="text-center py-4 text-sm text-slate-600">
                                Loading version history...
                              </div>
                            ) : (() => {
                              const versions = versionHistory[notification.id]
                              return versions && versions.length > 0 ? (
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                  Version History
                                </div>
                                <div className="relative">
                                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                                  {versions.map((version, vIndex) => {
                                    const isLatest = vIndex === 0
                                    const prevVersion = vIndex < versions.length - 1 
                                      ? versions[vIndex + 1] 
                                      : null
                                    const versionDoc = version.doc || version.data || {}
                                    
                                    return (
                                      <div key={version.id} className="relative pl-10 pb-4">
                                        <div className={cn(
                                          "absolute left-3 top-1 w-2 h-2 rounded-full border-2",
                                          isLatest 
                                            ? "bg-slate-900 border-slate-900" 
                                            : "bg-slate-300 border-slate-300"
                                        )} />
                                        <div className="text-xs">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium">
                                              Version {version.version}
                                              {isLatest && <Badge variant="outline" className="ml-2 text-xs">Current</Badge>}
                                            </span>
                                            <span className="text-slate-500">
                                              {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                                            </span>
                                          </div>
                                          {versionDoc && Object.keys(versionDoc).length > 0 && (
                                            <div className="mt-2 space-y-1 text-xs bg-white p-2 rounded border border-slate-200">
                                              {versionDoc.fromDate && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-500">Check-in:</span>
                                                  <span className="font-medium">
                                                    {format(new Date(versionDoc.fromDate), 'MMM d, yyyy')}
                                                  </span>
                                                </div>
                                              )}
                                              {versionDoc.toDate && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-500">Check-out:</span>
                                                  <span className="font-medium">
                                                    {format(new Date(versionDoc.toDate), 'MMM d, yyyy')}
                                                  </span>
                                                </div>
                                              )}
                                              {versionDoc.paymentStatus && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-500">Status:</span>
                                                  <Badge 
                                                    variant={versionDoc.paymentStatus === 'paid' ? 'default' : versionDoc.paymentStatus === 'cancelled' ? 'destructive' : 'outline'}
                                                    className="text-xs"
                                                  >
                                                    {versionDoc.paymentStatus}
                                                  </Badge>
                                                </div>
                                              )}
                                              {versionDoc.total && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-500">Total:</span>
                                                  <span className="font-medium">
                                                    R{versionDoc.total.toLocaleString()}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              ) : null
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Load More */}
        {filteredNotifications.length > 0 && filteredNotifications.length >= 100 && (
          <div className="text-center mt-6">
            <button className="px-6 py-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
              Load More Transactions
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />
    </div>
  )
}

