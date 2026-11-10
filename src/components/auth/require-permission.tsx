'use client'

import Link from 'next/link'
import { useCan, useProfile, type Permission } from '@/lib/hooks/use-profile'
import { PageLoader } from '@/components/ui/spinner'
import { Lock } from 'lucide-react'

// Shows the page only to roles the database would allow to complete it,
// instead of a form that fails on save.
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { data: profile, isPending } = useProfile()
  const allowed = useCan(permission)

  if (isPending) return <PageLoader />
  if (profile && allowed) return <>{children}</>

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-5 h-5" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 mb-1">Not available for your role</h2>
      <p className="text-sm text-slate-500 mb-4">
        Your role{profile?.role ? ` (${profile.role})` : ''} can&apos;t do this. Ask an admin if you need access.
      </p>
      <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
