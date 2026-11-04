import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(brands)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener marcas' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    const name = data.name.trim().toUpperCase()
    
    // Verificar si ya existe
    const existing = await prisma.brand.findFirst({ 
      where: { name: { equals: name, mode: 'insensitive' } } 
    })
    
    if (existing) {
      return NextResponse.json({ error: 'La marca ya existe' }, { status: 400 })
    }
    
    const brand = await prisma.brand.create({ data: { name } })
    return NextResponse.json(brand)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear marca' }, { status: 500 })
  }
}