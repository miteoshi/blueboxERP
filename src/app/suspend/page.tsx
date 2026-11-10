import { AlertTriangle, Mail } from 'lucide-react'
import { SignOutButton } from './sign-out-button'

export const metadata = { title: 'Access Suspended' }

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const userDeactivated = reason === 'user'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          {userDeactivated ? 'Your account is deactivated' : 'Access temporarily suspended'}
        </h1>
        {userDeactivated ? (
          <p className="text-sm text-slate-500 mb-6">
            An admin in your company has turned off your access to Blue Box ERP. Ask them to
            reactivate your account from Settings → Users.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">
              Your organization&apos;s access to Blue Box ERP has been paused. This is
              usually related to your subscription — please get in touch and we&apos;ll
              sort it out.
            </p>
            <a
              href="mailto:mitetoshi@gmail.com"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <Mail className="w-4 h-4" />
              mitetoshi@gmail.com
            </a>
          </>
        )}
        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}