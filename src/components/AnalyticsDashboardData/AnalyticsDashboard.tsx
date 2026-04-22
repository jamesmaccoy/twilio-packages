'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface AnalyticsData {
  activeUsersNow?: number
  total30DayUsers?: number
  total30DayViews?: number
  historicalData?: Array<{
    date: string
    users: number
    views: number
  }>
}

type JobMetrics = {
  total: number
  queued: number
  processing?: number
  completed: number
  failed: number
}

type SubscriptionMetrics = {
  activeCount: number
  totalYearTransactions: number
  goalRemaining: number
  yearlyGoal: number
  failedCount: number
  pendingCount: number
  upcomingExpiring: number
  staleActiveCount: number
}

type DashboardMetrics = {
  jobMetrics: {
    subscriptionEvents: JobMetrics
    nightlyCron: JobMetrics
  }
  subscriptionMetrics: SubscriptionMetrics
}

const fallbackData: AnalyticsData = {
  historicalData: [
    { date: '2025-03-15', users: 4, views: 5 },
    { date: '2025-03-16', users: 5, views: 6 },
    { date: '2025-03-17', users: 6, views: 7 },
    { date: '2025-03-18', users: 2, views: 3 },
    { date: '2025-03-19', users: 1, views: 2 },
    { date: '2025-03-20', users: 10, views: 15 },
    { date: '2025-03-21', users: 8, views: 12 },
    { date: '2025-03-22', users: 11, views: 13 },
    { date: '2025-03-23', users: 7, views: 9 },
    { date: '2025-03-24', users: 4, views: 5 },
    { date: '2025-03-25', users: 13, views: 15 },
    { date: '2025-03-26', users: 14, views: 16 },
    { date: '2025-03-27', users: 12, views: 14 },
    { date: '2025-03-28', users: 16, views: 18 },
    { date: '2025-03-29', users: 13, views: 15 },
    { date: '2025-03-30', users: 14, views: 17 },
    { date: '2025-03-31', users: 3, views: 4 },
    { date: '2025-04-01', users: 20, views: 24 },
  ],
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  const displayData = analytics || fallbackData
  const chartData = displayData.historicalData || []

  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/dashboard-metrics', { credentials: 'include' })
      if (!response.ok) throw new Error(`Dashboard metrics error: ${response.status}`)
      const data = await response.json()
      setMetrics(data)
      setMetricsError(null)
    } catch (err) {
      console.error('Error loading dashboard metrics:', err)
      setMetrics(null)
      setMetricsError(err instanceof Error ? err.message : 'Failed to load metrics')
    }
  }, [])

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const response = await fetch('/api/analytics', { headers: { 'Content-Type': 'application/json' } })
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const analyticsData = await response.json()
        const isEmpty =
          !analyticsData ||
          (analyticsData.activeUsersNow === 0 &&
            analyticsData.total30DayUsers === 0 &&
            (!analyticsData.historicalData || analyticsData.historicalData.length === 0))

        setAnalytics(isEmpty ? fallbackData : analyticsData)
        setError(null)
      } catch (err) {
        console.error('Error loading analytics:', err)
        setAnalytics(fallbackData)
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setLoading(false)
      }
    }

    const loadMetrics = async () => {
      await loadMetrics()
    }

    loadAnalytics()
    loadMetrics()
    const interval = setInterval(() => {
      loadAnalytics()
      loadMetrics()
    }, 120000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  useEffect(() => {
    const handler = async () => {
      try {
        await fetch('/api/admin/subscriptions/reconcile', {
          method: 'POST',
          credentials: 'include',
        })
        await loadMetrics()
      } catch (error) {
        console.error('Failed to trigger reconciliation', error)
        setMetricsError('Failed to trigger reconciliation')
      }
    }

    window.addEventListener('yoco:subscription-audit', handler)
    return () => window.removeEventListener('yoco:subscription-audit', handler)
  }, [loadMetrics])

  const subscriptionProgress = useMemo(() => {
    if (!metrics?.subscriptionMetrics) return 0
    const { totalYearTransactions, yearlyGoal } = metrics.subscriptionMetrics
    if (!yearlyGoal) return 0
    return Math.min(100, Math.round((totalYearTransactions / yearlyGoal) * 100))
  }, [metrics])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Admin Overview</h2>
        <p className="text-muted-foreground">
          Monitor subscription health, job queue activity, and traffic insights at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Subscriptions</CardTitle>
            <CardDescription>Currently active Yoco-based memberships</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {metrics?.subscriptionMetrics.activeCount ?? '—'}
            </div>
            <p className="text-sm text-muted-foreground">
              {metrics?.subscriptionMetrics.upcomingExpiring
                ? `${metrics.subscriptionMetrics.upcomingExpiring} expiring in 30 days`
                : 'No expirations within 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yearly Subscription Goal</CardTitle>
            <CardDescription>Completed renewals this calendar year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">
              {metrics?.subscriptionMetrics.totalYearTransactions ?? '—'}
              <span className="text-base font-normal text-muted-foreground">
                /{metrics?.subscriptionMetrics.yearlyGoal ?? '12'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${subscriptionProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {metrics?.subscriptionMetrics.goalRemaining
                ? `${metrics.subscriptionMetrics.goalRemaining} remaining to hit the annual target`
                : '🎉 Annual target reached'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attention Needed</CardTitle>
            <CardDescription>Expired transactions still marked active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">
              {metrics?.subscriptionMetrics.staleActiveCount ?? '—'}
            </div>
            <p className="text-sm text-muted-foreground">
              {metrics?.subscriptionMetrics.staleActiveCount
                ? 'Investigate these accounts—payments expired but users remain active.'
                : 'All active memberships line up with transaction expiries.'}
            </p>
            {metrics?.subscriptionMetrics.staleActiveCount ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent('yoco:subscription-audit'))}
              >
                Trigger Reconciliation
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              The automated reconciliation job runs every 30 minutes; use this button to re-run immediately if you’ve just fixed a payment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Job Queue</CardTitle>
            <CardDescription>handleSubscriptionEvent status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <MetricRow
              label="Queued"
              value={metrics?.jobMetrics.subscriptionEvents.queued}
            />
            <MetricRow
              label="Processing"
              value={metrics?.jobMetrics.subscriptionEvents.processing}
            />
            <MetricRow
              label="Completed"
              value={metrics?.jobMetrics.subscriptionEvents.completed}
            />
            <MetricRow
              label="Failed"
              value={metrics?.jobMetrics.subscriptionEvents.failed}
              emphasize={Boolean(metrics?.jobMetrics.subscriptionEvents.failed)}
            />
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <a
                href="/admin/jobs"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Job Queue
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nightly Downgrade Audit</CardTitle>
            <CardDescription>subscriptionDowngradeCheck queue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <MetricRow label="Queued" value={metrics?.jobMetrics.nightlyCron.queued} />
            <MetricRow
              label="Completed"
              value={metrics?.jobMetrics.nightlyCron.completed}
            />
            <MetricRow
              label="Failed"
              value={metrics?.jobMetrics.nightlyCron.failed}
              emphasize={Boolean(metrics?.jobMetrics.nightlyCron.failed)}
            />
          </CardContent>
        </Card>
      </div>

      {metricsError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Metrics unavailable</CardTitle>
            <CardDescription>{metricsError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              The job queue or subscription metrics endpoint returned an error. Retry shortly.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Traffic & Engagement</CardTitle>
          <CardDescription>Google Analytics highlights (fallback data when unavailable)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && <p className="text-sm text-muted-foreground">Loading analytics data…</p>}
          {error && (
            <p className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">
              {error} — showing cached values.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MiniStat
              label="Active Users Now"
              value={displayData.activeUsersNow || 0}
            />
            <MiniStat
              label="Total Users · 30 days"
              value={displayData.total30DayUsers || 0}
            />
            <MiniStat
              label="Total Views · 30 days"
              value={displayData.total30DayViews || 0}
            />
          </div>

          <div className="h-[360px] w-full">
            {chartData.length > 0 ? (
              <Line
                data={{
                  labels: chartData.map((item) => item.date),
                  datasets: [
                    {
                      label: 'Users',
                      data: chartData.map((item) => item.users),
                      borderColor: 'rgb(75, 192, 192)',
                      backgroundColor: 'rgba(75, 192, 192, 0.2)',
                      tension: 0.3,
                      fill: true,
                    },
                    {
                      label: 'Views',
                      data: chartData.map((item) => item.views),
                      borderColor: 'rgb(53, 162, 235)',
                      backgroundColor: 'rgba(53, 162, 235, 0.2)',
                      tension: 0.3,
                      fill: true,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true },
                  },
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No analytics data available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const MetricRow = ({
  label,
  value,
  emphasize,
}: {
  label: string
  value: number | undefined
  emphasize?: boolean
}) => (
  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn('font-semibold', emphasize && 'text-destructive')}>
      {typeof value === 'number' ? value : '—'}
    </span>
  </div>
)

const MiniStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border border-border bg-muted/30 p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold">{value}</p>
  </div>
)

export default AnalyticsDashboard

