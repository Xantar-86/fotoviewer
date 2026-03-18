import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { base_price, quantity, discount_percent = 0 } = await request.json()
  const subtotal = base_price * quantity
  const discount = subtotal * (discount_percent / 100)
  const total = subtotal - discount
  return NextResponse.json({
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100,
    per_item: quantity > 0 ? Math.round((total / quantity) * 100) / 100 : 0,
  })
}
