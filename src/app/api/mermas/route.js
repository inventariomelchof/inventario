import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    const data = await request.json()
    
    const product = await prisma.product.findUnique({ where: { id: data.productId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const quantity = parseInt(data.quantity)
    if (product.stock < quantity) return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 })

    const newStock = product.stock - quantity
    const newDamagedStock = product.damagedStock + quantity

    await prisma.product.update({
      where: { id: product.id },
      data: { 
        stock: newStock,
        damagedStock: newDamagedStock,
        totalWeight: newStock * product.unitWeight
      }
    })

    await prisma.kardexMovement.create({
      data: {
        productId: product.id,
        type: 'MERMA',
        quantity: quantity,
        previousStock: product.stock,
        newStock: newStock,
        userId: 'admin',
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al registrar merma' }, { status: 500 })
  }
}