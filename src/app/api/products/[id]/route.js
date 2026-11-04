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

    // Si es solo para descontinuar/activar el producto
    if (data.toggleOnly) {
        const product = await prisma.product.update({
            where: { id: params.id },
            data: { isActive: data.isActive }
        })
        return NextResponse.json(product)
    }
    
    // Si es edición completa, borramos las unidades viejas para crearlas de nuevo
    await prisma.productUnit.deleteMany({ where: { productId: params.id } })

    let family = await prisma.family.findFirst({ where: { categoryId: data.categoryId } })
    if (!family) family = await prisma.family.create({ data: { name: 'GENERAL', categoryId: data.categoryId } })

    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: 0 }]
    if (parseInt(data.packageUnits) > 1) {
        unitsToCreate.push({ name: data.packageName.toUpperCase(), multiplier: parseInt(data.packageUnits), price: 0 })
    }

    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ name: u.name.toUpperCase(), multiplier: parseInt(u.multiplier), price: 0 })
        }
      })
    }

    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    // Cálculo de Peso
    let packageWeight = parseFloat(data.packageWeight) || 0;
    if (data.weightUnit === 'g') packageWeight = packageWeight / 1000;
    const unitWeight = packageWeight / (parseInt(data.packageUnits) || 1); 

    const brandInfo = await prisma.brand.findUnique({ where: { id: data.brandId } })
    const generatedName = `${data.name} ${data.presentation} x${data.packageUnits}UND (${brandInfo?.name || ''})`.toUpperCase()

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: generatedName,
        description: generatedName,
        barcode: finalBarcode,
        unitWeight: unitWeight,
        packageWeight: packageWeight,
        categoryId: data.categoryId,
        familyId: family.id,
        brandId: data.brandId,
        units: { create: unitsToCreate }
      }
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}