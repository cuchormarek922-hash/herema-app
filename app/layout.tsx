import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Herema App',
  description: 'Project Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sk">
      <body>
        <AppLayout>{children}</AppLayout>
        <SpeedInsights />
      </body>
    </html>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-6 fixed h-screen overflow-y-auto">
        <div className="mb-12">
          <h1 className="text-2xl font-bold">Herema</h1>
          <p className="text-gray-400 text-sm">Správa projektov</p>
        </div>

        <nav className="space-y-2">
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/zamestnanci" label="Zamestnanci" />
          <NavLink href="/hodinovy-plan" label="Hodinový plán" />
          <NavLink href="/vyplaty" label="Výplaty" />
          <NavLink href="/naklady" label="Náklady" />
          <NavLink href="/kw-report" label="KW Report" />
          <NavLink href="/import" label="Import z Excelu" />
          <NavLink href="/import/aliases" label="↳ Aliasy mien" />
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-700">
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition"
    >
      {label}
    </a>
  )
}

function LogoutButton() {
  return (
    <a
      href="/api/auth/logout"
      className="block w-full text-left px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition text-sm"
    >
      Odhlásiť sa
    </a>
  )
}
