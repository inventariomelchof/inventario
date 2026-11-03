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

    // 1. Generar Código de Producto Secuencial de 6 dígitos (Ej: 000001)
    const count = await prisma.product.count()
    const internalCode = String(count + 1).padStart(6, '0')

    // 2. Gestión de Categorías y Marcas
    let category = await prisma.category.findUnique({ where: { name: data.category } })
    if (!category) category = await prisma.category.create({ data: { name: data.category } })

    let family = await prisma.family.findFirst({ where: { name: data.family, categoryId: category.id } })
    if (!family) family = await prisma.family.create({ data: { name: data.family, categoryId: category.id } })

    let brand = await prisma.brand.findUnique({ where: { name: data.brand } })
    if (!brand) brand = await prisma.brand.create({ data: { name: data.brand } })

    // 3. Manejo de Unidades de medida (Cajas, Displays, etc)
    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: 0 }]
    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ name: u.name, multiplier: parseInt(u.multiplier), price: 0 })
        }
      })
    }

    // 4. Código de barras automático si está vacío
    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    // 5. Cálculo de Peso (Convertir a kg si es ml o g)
    let weightInKg = parseFloat(data.weightValue) || 0;
    if (data.weightUnit === 'ml' || data.weightUnit === 'g') {
      weightInKg = weightInKg / 1000;
    }
    const totalWeight = weightInKg * parseInt(data.unitsPerPackage);

    // 6. Generar Descripción automática
    const generatedName = `${data.name} x${data.unitsPerPackage}UND (${data.brand})`.toUpperCase()

    const product = await prisma.product.create({
      data: {
        internalCode: internalCode,
        barcode: finalBarcode,
        name: generatedName,
        description: generatedName, // Se guarda igual para búsquedas
        unitWeight: weightInKg,
        packageWeight: totalWeight,
        totalWeight: 0,
        stock: 0,
        isActive: true,
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