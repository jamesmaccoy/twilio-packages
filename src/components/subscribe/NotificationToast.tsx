'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X } from 'lucide-react'

type NotificationToastProps = {
  transaction?: {
    id: string
    packageName?: string
    status: string
  }
}

export function NotificationToast({ transaction }: NotificationToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show notification if there's a pending transaction
    if (transaction && transaction.status === 'pending') {
      const timer = setTimeout(() => {
        setVisible(true)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [transaction])

  if (!transaction || transaction.status !== 'pending') {
    return null
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            x: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: 0,
          }}
          exit={{
            opacity: 0,
            x: 20,
          }}
          className="fixed right-4 top-4 z-50 w-80 rounded-lg border border-[#c9c9cf] bg-white p-4 shadow-lg"
        >
          <button
            onClick={() => setVisible(false)}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="rounded-full bg-teal-100 p-2 text-teal-600">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#020817]">
                Transaction Update
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Your recent payment for <strong>{transaction.packageName || 'subscription'}</strong> is
                pending manual review.
              </p>
              <div className="mt-2 text-xs font-medium text-[#2dd4bf]">
                View in history ↓
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

