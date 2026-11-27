'use client'

import { cn } from '@/lib/utils/cn'
import { forwardRef, useId } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, 'aria-describedby': describedBy, ...props }, ref) => {
    // The label and any message are tied to the field, so screen readers
    // announce them and tapping the label focuses the field
    const auto = useId()
    const fieldId = id ?? auto
    const noteId = error || hint ? `${fieldId}-note` : undefined
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, noteId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border bg-white',
            'placeholder:text-slate-400 text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            'transition-all duration-150',
            error
              ? 'border-red-300 focus:ring-red-400'
              : 'border-slate-300',
            className
          )}
          {...props}
        />
        {error && <p id={noteId} className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p id={noteId} className="text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'


// ── Textarea ──────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const auto = useId()
    const fieldId = id ?? auto
    const noteId = error ? `${fieldId}-note` : undefined
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, noteId].filter(Boolean).join(' ') || undefined}
          rows={3}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border bg-white resize-none',
            'placeholder:text-slate-400 text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-all duration-150',
            error ? 'border-red-300' : 'border-slate-300',
            className
          )}
          {...props}
        />
        {error && <p id={noteId} className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'