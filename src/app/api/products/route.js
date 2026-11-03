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

    // 1. Generar Código Interno de 6 dígitos secuencial
    const count = await prisma.product.count()
    const internalCode = String(count + 1).padStart(6, '0')

    // 2. Gestión de Categoría (Evitar duplicados con modo insensible a mayúsculas)
    const catName = data.category.trim().toUpperCase();
    let category = await prisma.category.findFirst({ where: { name: { equals: catName, mode: 'insensitive' } } })
    if (!category) category = await prisma.category.create({ data: { name: catName } })

    // Familia por defecto (General)
    let family = await prisma.family.findFirst({ where: { categoryId: category.id } })
    if (!family) family = await prisma.family.create({ data: { name: 'GENERAL', categoryId: category.id } })

    // Marca (Evitar duplicados)
    const brandName = data.brand.trim().toUpperCase();
    let brand = await prisma.brand.findFirst({ where: { name: { equals: brandName, mode: 'insensitive' } } })
    if (!brand) brand = await prisma.brand.create({ data: { name: brandName } })

    // 3. Unidades Adicionales
    const unitsToCreate = [{ name: 'Unidad', multiplier: 1, price: 0 }]
    if (data.customUnits && data.customUnits.length > 0) {
      data.customUnits.forEach(u => {
        if (u.name && parseInt(u.multiplier) > 1) {
          unitsToCreate.push({ name: u.name.toUpperCase(), multiplier: parseInt(u.multiplier), price: 0 })
        }
      })
    }
    // Agregamos el "Paquete" por defecto basado en las unidades que trae
    if (parseInt(data.unitsPerPackage) > 1) {
        unitsToCreate.push({ name: 'Paquete', multiplier: parseInt(data.unitsPerPackage), price: 0 })
    }

    // 4. Código de barras
    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    // 5. Cálculo de Peso a KG
    let weightInKg = parseFloat(data.weightValue) || 0;
    if (data.weightUnit === 'ml' || data.weightUnit === 'g') weightInKg = weightInKg / 1000;
    const totalWeight = weightInKg * (parseInt(data.unitsPerPackage) || 1);

    const generatedName = `${data.name} x${data.unitsPerPackage}UND (${data.brand})`.toUpperCase()

    const product = await prisma.product.create({
      data: {
        internalCode: internalCode,
        barcode: finalBarcode,
        name: generatedName,
        description: generatedName,
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
    console.error("Error al crear producto:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}