import { describe, expect, it } from 'vitest'
import { approvalLabel, isOverride } from './approvals'

describe('approvals trail', () => {
  it('labels every action the database allows', () => {
    expect(approvalLabel('sent_for_approval')).toBe('Sent for approval')
    expect(approvalLabel('approved')).toBe('Approved')
    expect(approvalLabel('rejected')).toBe('Rejected')
    expect(approvalLabel('revision_requested')).toBe('Revision requested')
    expect(approvalLabel('converted_after_expiry')).toBe('Converted after expiry')
    expect(approvalLabel('converted_over_credit_limit')).toBe('Converted over the credit limit')
  })

  it('reads an unknown action rather than hiding it', () => {
    expect(approvalLabel('put_on_hold')).toBe('Put on hold')
  })

  it('marks only the manager overrides', () => {
    expect(isOverride('converted_after_expiry')).toBe(true)
    expect(isOverride('converted_over_credit_limit')).toBe(true)
    expect(isOverride('approved')).toBe(false)
    expect(isOverride('put_on_hold')).toBe(false)
  })
})
