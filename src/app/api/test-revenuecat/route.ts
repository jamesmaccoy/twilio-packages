import { NextRequest, NextResponse } from 'next/server'
import { yocoService } from '@/lib/yocoService'

export async function GET(request: NextRequest) {
  try {
    // Test Yoco service initialization
    await yocoService.initialize()
    
    // Test getting products
    const products = await yocoService.getProducts()
    
    return NextResponse.json({
      success: true,
      message: 'Yoco integration is working',
      productsCount: products.length,
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category
      }))
    })
  } catch (error) {
    console.error('Yoco test failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Yoco integration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
} 