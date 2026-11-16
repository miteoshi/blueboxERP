import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { TenantProvider } from '@/components/providers/tenant-provider'

// This layout wraps every page inside (dashboard)
// It checks auth server-side as a second layer of protection
// and ensures the user belongs to an organization before entering.
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

  // Server-side check: if profile has no org_id, route to onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.org_id) {
    redirect('/onboarding')
  }

  // A deactivated user can sign in but the database shows them nothing
  if (profile && !profile.is_active) {
    redirect('/suspend?reason=user')
  }

  // Manual access switch — flip organizations.access_status in Supabase to
  // 'suspended' and every user in that org gets routed here on next load.
  const { data: isActive } = await supabase.rpc('org_is_active')

  if (isActive === false) {
    redirect('/suspend')
  }

  return (
    <TenantProvider>
      <div className="flex min-h-screen bg-slate-50">

        {/* Fixed sidebar on a desktop; a drawer under a top bar on a phone */}
        <Sidebar />

        {/* Main content — offset by the sidebar on a desktop, by the top bar
            on a phone. min-w-0 keeps a wide table scrolling inside its own
            box instead of stretching the whole page sideways. */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-64">

          {/* Page content */}
          <main className="flex-1 px-4 pb-4 pt-[4.5rem] lg:p-6 lg:pt-6 animate-fade-in">
            {children}
          </main>

        </div>
      </div>
    </TenantProvider>
  )
}