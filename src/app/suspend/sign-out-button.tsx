'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    await createClient().auth.signOut()
    // Full reload so no cached data from this session survives
    window.location.assign('/login')
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
