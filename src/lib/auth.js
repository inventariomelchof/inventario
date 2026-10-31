import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Buscamos al usuario en la base de datos
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        // Verificamos la contraseña
        if (user && user.password === credentials.password) {
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role
      return token
    },
    async session({ session, token }) {
      if (session?.user) session.user.role = token.role
      return session
    }
  },
  pages: {
    signIn: '/login', // Aquí crearemos la pantalla de login luego
  },
  secret: process.env.NEXTAUTH_SECRET
}