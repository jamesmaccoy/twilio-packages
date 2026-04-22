'use client'

import React from 'react'
import { YocoProduct } from '@/lib/yocoService'
import { 
  getZARPriceFromRevenueCatProduct, 
  getDualCurrencyPrice 
} from '@/lib/currency'

interface CurrencyExampleProps {
  package: YocoProduct
}

export const CurrencyExample: React.FC<CurrencyExampleProps> = ({ package: pkg }) => {
  // Get the product from the package
  const product = pkg.webBillingProduct

  // Use the new API v2 currency functions
  const zarPrice = getZARPriceFromRevenueCatProduct(product)
  const dualPrice = getDualCurrencyPrice(product)

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">{pkg.identifier}</h3>
      
      {/* Single ZAR Price */}
      <div className="mb-2">
        <span className="font-medium">ZAR Price: </span>
        <span className="text-green-600">{zarPrice}</span>
      </div>

      {/* Dual Currency Display */}
      <div className="mb-2">
        <span className="font-medium">Dual Currency: </span>
        <span className="text-blue-600">{dualPrice.usd}</span>
        <span className="mx-2">/</span>
        <span className="text-green-600">{dualPrice.zar}</span>
      </div>

      {/* Raw Product Data for Debugging */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600">
          Raw Product Data
        </summary>
        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
          {JSON.stringify(product, null, 2)}
        </pre>
      </details>
    </div>
  )
}

// Example usage in a subscription component
export const SubscriptionPricingExample: React.FC = () => {
  const [packages, setPackages] = React.useState<Package[]>([])

  React.useEffect(() => {
    // This would be called when you load packages from RevenueCat
    const loadPackages = async () => {
      // Example of how to use the currency functions
      // packages.forEach(pkg => {
      //   const zarPrice = getZARPriceFromRevenueCatProduct(pkg.webBillingProduct)
      //   console.log(`${pkg.identifier}: ${zarPrice}`)
      // })
    }
    
    loadPackages()
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Subscription Pricing</h2>
      {packages.map((pkg) => (
        <CurrencyExample key={pkg.identifier} package={pkg} />
      ))}
    </div>
  )
} 