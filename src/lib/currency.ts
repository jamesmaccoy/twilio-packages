export function formatAmountToZAR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'N/A'

  const numericAmount = Number(amount)
  const sign = numericAmount < 0 ? '-' : ''
  const absolute = Math.abs(numericAmount)
  const fixed = absolute.toFixed(2)
  const parts = fixed.split('.')
  const integerPart = parts[0]
  const decimal = parts[1]
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return `${sign}R ${withThousands.length > 0 ? withThousands : '0'}.${decimal}`
}

export function formatAmountToZARNoCents(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'N/A'

  const numericAmount = Number(amount)
  const sign = numericAmount < 0 ? '-' : ''
  const absoluteWhole = Math.round(Math.abs(numericAmount))
  const withThousands = String(absoluteWhole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return `${sign}R ${withThousands.length > 0 ? withThousands : '0'}`
}

export function formatFormattedPriceToZAR(formattedPrice: string | null | undefined): string {
  if (!formattedPrice || typeof formattedPrice !== 'string') return 'N/A'
  // Replace any leading currency symbol(s) with R
  // This preserves the numeric portion (e.g. "$9.99" -> "R9.99")
  return formattedPrice.replace(/^[^\d\-.,\s]+/, 'R')
}

// Enhanced function for RevenueCat Purchases API v2
export function getZARPriceFromProduct(product: any): string {
  // For RevenueCat Purchases API v2, the price structure has changed
  // Priority: currentPrice -> price -> fallback
  
  // Check for the new API v2 price structure
  if (product?.currentPrice) {
    const currentPrice = product.currentPrice
    
    // Try to get the amount first
    if (typeof currentPrice.amount === 'number') {
      // Convert USD to ZAR if currency is USD
      const amount = currentPrice.currencyCode === 'usd' 
        ? convertUSDToZAR(currentPrice.amount) 
        : currentPrice.amount
      return formatAmountToZAR(amount)
    }
    
    // Try formatted price
    if (typeof currentPrice.formattedPrice === 'string') {
      return formatFormattedPriceToZAR(currentPrice.formattedPrice)
    }
  }
  
  // Fallback to legacy price structure
  const amount = product?.price
  if (typeof amount === 'number') {
    // Assume USD if no currency specified
    const zarAmount = convertUSDToZAR(amount)
    return formatAmountToZAR(zarAmount)
  }
  
  // Try priceString as last resort
  const formatted = product?.priceString
  if (typeof formatted === 'string') {
    return formatFormattedPriceToZAR(formatted)
  }
  
  return 'N/A'
}

// New function specifically for RevenueCat Purchases API v2
export function getZARPriceFromRevenueCatProduct(product: any): string {
  if (!product) return 'N/A'
  
  // RevenueCat Purchases API v2 has a more structured price object
  if (product.currentPrice) {
    const { amount, currencyCode, formattedPrice } = product.currentPrice
    
    // If we have a numeric amount, convert to ZAR if needed
    if (typeof amount === 'number') {
      const zarAmount = currencyCode === 'usd' ? convertUSDToZAR(amount) : amount
      return formatAmountToZAR(zarAmount)
    }
    
    // If we have a formatted price, convert the currency symbol
    if (typeof formattedPrice === 'string') {
      return formatFormattedPriceToZAR(formattedPrice)
    }
  }
  
  // Fallback to legacy structure
  return getZARPriceFromProduct(product)
}

// Function to convert USD to ZAR (approximate conversion)
export function convertUSDToZAR(usdAmount: number): number {
  // Approximate exchange rate (you might want to use a real-time API)
  const exchangeRate = 18.5 // 1 USD ≈ 18.5 ZAR
  return usdAmount * exchangeRate
}

// Configurable ZAR price overrides for specific products
const ZAR_PRICE_OVERRIDES: Record<string, number> = {
  'virtual_wine': 185.00,      // Weekly subscription in ZAR (Bottle of Virtual Wine)
  'monthly_subscription': 350.00,    // Monthly subscription in ZAR ($20.00 → R352.00)
  'annual_subscription': 3530.00,     // Annual subscription in ZAR ($200.00 → R3,529.00)
  'subscription_pro': 880.00,  // Professional subscription in ZAR ($50.00 → R882.00)
  // Add more overrides as needed
}

// Function to get both USD and ZAR prices
export function getDualCurrencyPrice(product: any): { usd: string; zar: string } {
  if (!product) return { usd: 'N/A', zar: 'N/A' }
  
  // Check if we have a ZAR price override for this product
  const productId = product.identifier || product.id
  if (productId && ZAR_PRICE_OVERRIDES[productId]) {
    const zarOverride = ZAR_PRICE_OVERRIDES[productId]
    return {
      usd: product.currentPrice?.formattedPrice || `$${product.currentPrice?.amount ? (product.currentPrice.amount / 100).toFixed(2) : '0.00'}`,
      zar: formatAmountToZAR(zarOverride)
    }
  }
  
  // Check if RevenueCat is already providing formatted prices
  if (product.currentPrice?.formattedPrice) {
    const usdFormatted = product.currentPrice.formattedPrice
    const zarFormatted = formatFormattedPriceToZAR(usdFormatted)
    return {
      usd: usdFormatted,
      zar: zarFormatted
    }
  }
  
  let usdAmount: number | null = null
  
  // Try to get USD amount from RevenueCat product
  if (product.currentPrice?.amount) {
    usdAmount = product.currentPrice.amount
  } else if (product.price) {
    usdAmount = product.price
  }
  
  if (usdAmount !== null) {
    // Check if amount is in cents (RevenueCat sometimes provides cents)
    const normalizedAmount = usdAmount > 1000 ? usdAmount / 100 : usdAmount
    const zarAmount = convertUSDToZAR(normalizedAmount)
    return {
      usd: `$${normalizedAmount.toFixed(2)}`,
      zar: formatAmountToZAR(zarAmount)
    }
  }
  
  // Fallback to string conversion
  const zarPrice = getZARPriceFromRevenueCatProduct(product)
  return {
    usd: product.currentPrice?.formattedPrice || product.priceString || 'N/A',
    zar: zarPrice
  }
}

// Helper function to check if RevenueCat is configured for ZAR
export function checkRevenueCatCurrency(product: any): { isZAR: boolean; currency: string; message: string } {
  if (!product) {
    return { isZAR: false, currency: 'unknown', message: 'No product data' }
  }
  
  const currency = product.currentPrice?.currencyCode || 'unknown'
  const isZAR = currency === 'zar' || currency === 'ZAR'
  
  return {
    isZAR,
    currency,
    message: isZAR 
      ? 'RevenueCat is properly configured for ZAR' 
      : `RevenueCat is using ${currency.toUpperCase()}. Configure RevenueCat dashboard to use ZAR currency.`
  }
} 