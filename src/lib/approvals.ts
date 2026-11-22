// Actions in the approvals trail (approvals_action_check) and how they read.
// An override is a step a manager took past a rule that stops a sales user.

const ACTIONS: Record<string, { label: string; override?: boolean }> = {
  sent_for_approval: { label: 'Sent for approval' },
  approved: { label: 'Approved' },
  rejected: { label: 'Rejected' },
  revision_requested: { label: 'Revision requested' },
  converted_after_expiry: { label: 'Converted after expiry', override: true },
  converted_over_credit_limit: { label: 'Converted over the credit limit', override: true },
}

export function approvalLabel(action: string): string {
  return ACTIONS[action]?.label ?? action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export function isOverride(action: string): boolean {
  return ACTIONS[action]?.override === true
}
