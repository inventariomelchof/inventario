import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(categories)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    const name = data.name.trim().toUpperCase()
    
    // Verificar si ya existe (sin importar mayúsculas/minúsculas)
    const existing = await prisma.category.findFirst({ 
      where: { name: { equals: name, mode: 'insensitive' } } 
    })
    
    if (existing) {
      return NextResponse.json({ error: 'La categoría ya existe' }, { status: 400 })
    }
    
    const category = await prisma.category.create({ data: { name } })
    return NextResponse.json(category)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}