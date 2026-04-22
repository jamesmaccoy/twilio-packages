'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface Transaction {
  id: string
  createdAt?: string
  packageName?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  amount?: number
  currency?: string
  plan?: string
  entitlement?: string
  expiresAt?: string
  paymentUrl?: string
}

interface TransactionFeedProps {
  transactions: Transaction[]
  loading?: boolean
}

export function TransactionFeed({ transactions, loading }: TransactionFeedProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Unknown'
    }
  }

  const formatExpires = (dateString?: string) => {
    if (!dateString) return 'Manual review'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Manual review'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-[#dcfce7] text-[#166534] border-transparent">
            Completed
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-[#fef3c7] text-[#92400e] border-transparent">
            Pending
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-transparent">
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        )
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'failed':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'pending':
        return 'bg-amber-100 text-amber-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        Fetching transactions...
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        No subscription payments recorded yet.
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#020817]">
            Transaction Insight
          </h3>
          <p className="text-sm text-slate-500">
            Real-time payment verification log
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          Live Feed
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {transactions.map((tx, index) => (
            <motion.div
              key={tx.id}
              initial={{
                opacity: 0,
                x: -20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: index * 0.05,
                type: 'spring',
                stiffness: 300,
                damping: 24,
              }}
              className="group relative overflow-hidden rounded border border-[#c9c9cf] bg-white p-4 transition-all hover:border-[#2dd4bf] hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: Date & Description */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 rounded-full p-1.5 ${getStatusColor(tx.status)}`}
                  >
                    {getStatusIcon(tx.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#020817]">
                        {tx.packageName || 'Subscription payment'}
                      </p>
                      <span className="text-xs text-slate-400">
                        • {formatDate(tx.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        Plan:{' '}
                        <strong className="font-medium text-slate-700">
                          {tx.plan || 'n/a'}
                        </strong>
                      </span>
                      <span>
                        Expires:{' '}
                        <strong className="font-medium text-slate-700">
                          {formatExpires(tx.expiresAt)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Action */}
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-right">
                    <p className="font-bold text-[#020817]">
                      {tx.currency || 'ZAR'} {tx.amount?.toFixed(2) || '0.00'}
                    </p>
                    {getStatusBadge(tx.status)}
                  </div>

                  {tx.paymentUrl && tx.status === 'pending' && (
                    <a
                      href={tx.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-[#2dd4bf] hover:text-[#164e63]"
                      title="Resume Payment"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

