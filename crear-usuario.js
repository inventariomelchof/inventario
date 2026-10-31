const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@inventario.com' },
    update: {},
    create: {
      id: 'admin',
      name: 'Administrador',
      email: 'admin@inventario.com',
      password: 'admin123',
      role: 'ADMIN'
    }
  })
  console.log('? Usuario admin creado con éxito en Supabase')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())