import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request, { params }) {
  try {
    await prisma.productUnit.deleteMany({ where: { productId: params.id } })
    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const data = await request.json()
    
    await prisma.productUnit.deleteMany({ where: { productId: params.id } })

    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: parseFloat(data.priceUnit) || 0 }]
    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ name: u.name, multiplier: parseInt(u.multiplier), price: parseFloat(u.price) || 0 })
        }
      })
    }

    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: data.name,
        barcode: finalBarcode,
        unitWeight: parseFloat(data.unitWeight) || 0,
        packageWeight: parseFloat(data.packageWeight) || 0, // <-- PESO PAQUETE
        totalWeight: (parseFloat(data.unitWeight) || 0) * (parseInt(data.stock) || 0),
        stock: parseInt(data.stock) || 0,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        units: { create: unitsToCreate }
      }
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al editar' }, { status: 500 })
  }
}