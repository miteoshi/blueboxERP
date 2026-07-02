import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

// This layout wraps every page inside (dashboard)
// It checks auth server-side as a second layer of protection
// (middleware already redirects, but this is a belt-and-suspenders check)
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content — offset by sidebar width */}
      <div className="flex-1 flex flex-col ml-64">

        {/* Sticky header */}
        {/* <Header /> */}

        {/* Page content */}
        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>

      </div>
    </div>
  )
}