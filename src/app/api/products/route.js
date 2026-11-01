import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, family: true, brand: true, units: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()

    let category = await prisma.category.findUnique({ where: { name: data.category } })
    if (!category) category = await prisma.category.create({ data: { name: data.category } })

    let family = await prisma.family.findFirst({ where: { name: data.family, categoryId: category.id } })
    if (!family) family = await prisma.family.create({ data: { name: data.family, categoryId: category.id } })

    let brand = await prisma.brand.findUnique({ where: { name: data.brand } })
    if (!brand) brand = await prisma.brand.create({ data: { name: data.brand } })

    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: parseFloat(data.priceUnit) || 0 }]
    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ 
            name: u.name, 
            multiplier: parseInt(u.multiplier) || 1, 
            price: parseFloat(u.price) || 0 
          })
        }
      })
    }

    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    // VALIDACIONES PARA EVITAR EL ERROR DE PRISMA
    const parsedStock = parseInt(data.stock);
    const finalStock = isNaN(parsedStock) ? 0 : parsedStock;

    const parsedWeight = parseFloat(data.unitWeight);
    const finalUnitWeight = isNaN(parsedWeight) ? 0 : parsedWeight;

    let finalDate = null;
    if (data.expirationDate && data.expirationDate.trim() !== '') {
      const d = new Date(data.expirationDate);
      if (!isNaN(d.getTime())) finalDate = d; // Solo guarda si la fecha es válida
    }

    const product = await prisma.product.create({
      data: {
        internalCode: 'P-' + Date.now().toString().slice(-6),
        barcode: finalBarcode,
        name: data.name,
        unitWeight: finalUnitWeight,
        totalWeight: finalUnitWeight * finalStock,
        stock: finalStock,
        expirationDate: finalDate,
        categoryId: category.id,
        familyId: family.id,
        brandId: brand.id,
        units: { create: unitsToCreate }
      }
    })
    return NextResponse.json(product)
  } catch (error) {
    console.error("ERROR DETALLADO:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}