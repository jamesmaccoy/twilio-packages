'use client'

import React, { useEffect, useState } from 'react'
import { useYoco } from '@/providers/Yoco'
import { yocoService, YocoProduct } from '@/lib/yocoService'
import { 
  getZARPriceFromRevenueCatProduct, 
  getDualCurrencyPrice, 
  formatAmountToZAR,
  convertUSDToZAR,
  checkRevenueCatCurrency
} from '@/lib/currency'

export const CurrencyTest: React.FC = () => {
  const { isInitialized } = useYoco()
  const [packages, setPackages] = useState<YocoProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isInitialized) {
      loadPackages()
    }
  }, [isInitialized])

  const loadPackages = async () => {
    try {
      setLoading(true)
      const products = await yocoService.getProducts()
      setPackages(products)
    } catch (error) {
      console.error('Error loading packages:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isInitialized) {
    return <div className="p-4">Yoco not initialized</div>
  }

  if (loading) {
    return <div className="p-4">Loading packages...</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Currency Display Test</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Functions</h2>
        <div className="space-y-2 text-sm">
          <div>formatAmountToZAR(10): {formatAmountToZAR(10)}</div>
          <div>convertUSDToZAR(10): {convertUSDToZAR(10)}</div>
          <div>formatAmountToZAR(convertUSDToZAR(10)): {formatAmountToZAR(convertUSDToZAR(10))}</div>
        </div>
      </div>

      <div className="grid gap-4">
        {packages.map((pkg) => {
          const product = pkg.webBillingProduct
          const zarPrice = getZARPriceFromRevenueCatProduct(product)
          const dualPrice = getDualCurrencyPrice(product)
          const currencyStatus = checkRevenueCatCurrency(product)
          
          return (
            <div key={pkg.identifier} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{pkg.identifier}</h3>
              
              {/* Currency Configuration Status */}
              <div className="mb-4 p-3 rounded-lg bg-gray-50">
                <h4 className="font-medium text-sm text-gray-600 mb-1">Currency Configuration</h4>
                <div className={`text-sm ${currencyStatus.isZAR ? 'text-green-600' : 'text-orange-600'}`}>
                  {currencyStatus.message}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Currency: {currencyStatus.currency.toUpperCase()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-1">Single ZAR Price</h4>
                  <div className="text-lg font-bold text-green-600">{zarPrice}</div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-1">Dual Currency</h4>
                  <div className="space-y-1">
                    <div className="text-sm text-blue-600">{dualPrice.usd}</div>
                    <div className="text-sm text-green-600">{dualPrice.zar}</div>
                  </div>
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Raw Product Data
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(product, null, 2)}
                </pre>
              </details>
            </div>
          )
        })}
      </div>
      
      {packages.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No packages found. Make sure RevenueCat is properly configured.
        </div>
      )}
    </div>
  )
} 