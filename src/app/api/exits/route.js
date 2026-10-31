import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    const data = await request.json()
    
    // Usamos una transacción para que si falla un producto, no guarde nada
    const result = await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        
        if (product.stock < item.quantity) {
          throw new Error(`Stock insuficiente de: ${product.name}`)
        }
        
        const newStock = product.stock - item.quantity
        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock, totalWeight: newStock * product.unitWeight }
        })

        await tx.kardexMovement.create({
          data: {
            productId: product.id,
            type: 'SALIDA',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: newStock,
            userId: 'admin'
          }
        })
      }
      return { success: true }
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}