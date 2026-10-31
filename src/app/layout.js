import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata = {
  title: 'Sistema de Inventario',
  description: 'Sistema profesional de inventario',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}