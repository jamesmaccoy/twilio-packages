'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUserContext } from '@/context/UserContext'
import { yocoService, YocoCustomer, YocoPaymentLink } from '@/lib/yocoService'

// Define types for Yoco
type CustomerInfo = YocoCustomer

type PaymentLinkMetadata = {
  estimateId?: string
  postId?: string
  duration?: number
  startDate?: string
  endDate?: string
  version?: string
  intent?: 'booking' | 'subscription' | 'product'
  entitlement?: 'none' | 'standard' | 'pro'
  plan?: 'free' | 'standard' | 'pro'
  periodDays?: number
}

type YocoContextType = {
  customerInfo: CustomerInfo | null
  isLoading: boolean
  isInitialized: boolean
  error: Error | null
  refreshCustomerInfo: () => Promise<CustomerInfo | null | void>
  restorePurchases: () => Promise<CustomerInfo | null | void>
  createPaymentLink: (
    productId: string,
    customerName?: string,
    metadata?: PaymentLinkMetadata
  ) => Promise<YocoPaymentLink | null>
  createPaymentLinkFromDatabase?: (
    packageData: any,
    customerName: string | undefined,
    total: number,
    metadata?: PaymentLinkMetadata
  ) => Promise<YocoPaymentLink | null>
}

const YocoContext = createContext<YocoContextType | undefined>(undefined)

export const YocoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useUserContext()
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    const initYoco = async () => {
      try {
        setIsLoading(true)
        
        await yocoService.initialize()
        setIsInitialized(true)

        // Only try to get customer info if user is authenticated and has valid ID
        if (!currentUser || !currentUser.id || currentUser.id === '[Not provided]' || currentUser.id === '') {
          console.log('No valid user for Yoco customer info')
          setCustomerInfo(null)
          setError(null)
          return
        }
        
        try {
          const info = await yocoService.getCustomerInfo(String(currentUser.id))
          setCustomerInfo(info)
          setError(null)
        } catch (customerInfoError) {
          console.error('Failed to get customer info:', customerInfoError)
          // Don't set this as a fatal error - just log it
          setCustomerInfo(null)
          setError(null) // Clear error since this is expected for unauthenticated users
        }
      } catch (err) {
        console.error('Yoco getCustomerInfo error:', err)
        setError(err instanceof Error ? err : new Error('Failed to load customer info'))
        setCustomerInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    initYoco()
  }, [currentUser])

  const refreshCustomerInfo = async () => {
    if (typeof window === 'undefined') return

    try {
      setIsLoading(true)
      if (!currentUser?.id) {
        setCustomerInfo(null)
        return
      }
      const info = await yocoService.getCustomerInfo(String(currentUser.id))
      setCustomerInfo(info)
      return info
    } catch (err) {
      console.error('Failed to refresh customer info:', err)
      setError(err instanceof Error ? err : new Error('Unknown error refreshing customer info'))
    } finally {
      setIsLoading(false)
    }
  }

  const restorePurchases = async () => {
    if (typeof window === 'undefined') return
    
    try {
      setIsLoading(true)
      if (!currentUser?.id) {
        setCustomerInfo(null)
        return
      }
      const info = await yocoService.getCustomerInfo(String(currentUser.id))
      setCustomerInfo(info)
      return info
    } catch (err) {
      console.error('Failed to restore purchases:', err)
      setError(err instanceof Error ? err : new Error('Unknown error restoring purchases'))
    } finally {
      setIsLoading(false)
    }
  }

  const createPaymentLink = async (
    productId: string,
    customerName?: string,
    metadata?: PaymentLinkMetadata
  ): Promise<YocoPaymentLink | null> => {
    try {
      const response = await fetch('/api/yoco/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          customerName,
          ...metadata,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create payment link')
      }

      const { paymentLink } = await response.json()
      return paymentLink as YocoPaymentLink
    } catch (err) {
      console.error('Failed to create payment link:', err)
      setError(err instanceof Error ? err : new Error('Failed to create payment link'))
      return null
    }
  }

  const createPaymentLinkFromDatabase = async (
    packageData: any,
    customerName: string | undefined,
    total: number,
    metadata?: PaymentLinkMetadata
  ): Promise<YocoPaymentLink | null> => {
    try {
      const response = await fetch('/api/yoco/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          packageData,
          customerName,
          total,
          ...metadata,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create payment link')
      }

      const { paymentLink } = await response.json()
      return paymentLink as YocoPaymentLink
    } catch (err) {
      console.error('Failed to create payment link from database package:', err)
      setError(err instanceof Error ? err : new Error('Failed to create payment link'))
      return null
    }
  }

  return (
    <YocoContext.Provider
      value={{
        customerInfo,
        isLoading,
        isInitialized,
        error,
        refreshCustomerInfo,
        restorePurchases,
        createPaymentLink,
        createPaymentLinkFromDatabase,
      }}
    >
      {children}
    </YocoContext.Provider>
  )
}

export const useYoco = () => {
  const context = useContext(YocoContext)
  if (context === undefined) {
    throw new Error('useYoco must be used within a YocoProvider')
  }
  return context
}

// Keep backward compatibility
export const useRevenueCat = useYoco
export const RevenueCatProvider = YocoProvider 