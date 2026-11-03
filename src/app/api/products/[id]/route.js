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

    // Si es solo para descontinuar/activar
    if (data.toggleOnly) {
        const product = await prisma.product.update({
            where: { id: params.id },
            data: { isActive: data.isActive }
        })
        return NextResponse.json(product)
    }
    
    // Si es edición completa
    await prisma.productUnit.deleteMany({ where: { productId: params.id } })

    const catName = data.category.trim().toUpperCase();
    let category = await prisma.category.findFirst({ where: { name: { equals: catName, mode: 'insensitive' } } })
    if (!category) category = await prisma.category.create({ data: { name: catName } })

    let family = await prisma.family.findFirst({ where: { categoryId: category.id } })
    if (!family) family = await prisma.family.create({ data: { name: 'GENERAL', categoryId: category.id } })

    const brandName = data.brand.trim().toUpperCase();
    let brand = await prisma.brand.findFirst({ where: { name: { equals: brandName, mode: 'insensitive' } } })
    if (!brand) brand = await prisma.brand.create({ data: { name: brandName } })

    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: 0 }]
    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ name: u.name.toUpperCase(), multiplier: parseInt(u.multiplier), price: 0 })
        }
      })
    }
    if (parseInt(data.unitsPerPackage) > 1) {
        unitsToCreate.push({ name: 'Paquete', multiplier: parseInt(data.unitsPerPackage), price: 0 })
    }

    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    let weightInKg = parseFloat(data.weightValue) || 0;
    if (data.weightUnit === 'ml' || data.weightUnit === 'g') weightInKg = weightInKg / 1000;
    
    const generatedName = `${data.name} x${data.unitsPerPackage}UND (${data.brand})`.toUpperCase()

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: generatedName,
        description: generatedName,
        barcode: finalBarcode,
        unitWeight: weightInKg,
        packageWeight: weightInKg * (parseInt(data.unitsPerPackage) || 1),
        categoryId: category.id,
        familyId: family.id,
        brandId: brand.id,
        units: { create: unitsToCreate }
      }
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}