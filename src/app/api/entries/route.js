import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const movements = await prisma.kardexMovement.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json(movements)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    
    // 1. Buscamos el producto actual
    const product = await prisma.product.findUnique({ where: { id: data.productId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const quantity = parseInt(data.quantity)
    const newStock = product.stock + quantity

    // 2. Actualizamos el stock del producto
    await prisma.product.update({
      where: { id: product.id },
      data: { 
        stock: newStock,
        totalWeight: newStock * product.unitWeight
      }
    })

    // 3. Registramos el movimiento en el Kardex
    const movement = await prisma.kardexMovement.create({
      data: {
        productId: product.id,
        type: 'ENTRADA',
        quantity: quantity,
        previousStock: product.stock,
        newStock: newStock,
        userId: 'admin', // Por ahora usaremos 'admin', luego crearemos el Login
      }
    })

    return NextResponse.json(movement)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 })
  }
}