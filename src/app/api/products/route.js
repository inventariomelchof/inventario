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
    
    // Generar código interno de 6 dígitos
    const count = await prisma.product.count()
    const internalCode = String(count + 1).padStart(6, '0')

    // Buscar o crear la familia por defecto para la categoría seleccionada
    let family = await prisma.family.findFirst({ where: { categoryId: data.categoryId } })
    if (!family) family = await prisma.family.create({ data: { name: 'GENERAL', categoryId: data.categoryId } })

    // Configurar las unidades de medida (Unidad base + Paquete principal + Presentaciones extra)
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

    // Código de barras automático si está vacío
    let finalBarcode = data.barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      finalBarcode = `200${randomPart}`;
    }

    // Cálculo de Peso: (Peso total del paquete / Unidades que trae) = Peso de 1 unidad
    let packageWeight = parseFloat(data.packageWeight) || 0;
    if (data.weightUnit === 'g') packageWeight = packageWeight / 1000; // Convertir g a kg
    const unitWeight = packageWeight / (parseInt(data.packageUnits) || 1); 

    // Generar nombre/descripción automático
    const brandInfo = await prisma.brand.findUnique({ where: { id: data.brandId } })
    const generatedName = `${data.name} ${data.presentation} x${data.packageUnits}UND (${brandInfo?.name || ''})`.toUpperCase()

    const product = await prisma.product.create({
      data: {
        internalCode: internalCode,
        barcode: finalBarcode,
        name: generatedName,
        description: generatedName,
        unitWeight: unitWeight,
        packageWeight: packageWeight,
        totalWeight: 0,
        stock: 0,
        isActive: true,
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