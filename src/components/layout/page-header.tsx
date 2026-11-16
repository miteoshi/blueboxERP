import { cn } from '@/lib/utils/cn'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode  // action buttons go here
  className?: string
}

// Use at the top of every page:
// <PageHeader title="Quotations" description="Manage customer price offers">
//   <Button>New Quotation</Button>
// </PageHeader>
export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(
      'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6',
      className
    )}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  )
}