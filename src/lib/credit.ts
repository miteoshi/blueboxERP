// Credit check before a quotation becomes a sales order. Mirrors
// convert_quotation_to_sales_order(): when the customer has a credit limit,
// a sales user is refused if exposure + the order total exceeds it; an admin
// or manager may go over.

export type CreditPosition = {
  credit_limit: number
  exposure: number
  overdue: number
}

export type CreditCheck = {
  limit: number | null      // null when the customer has no limit
  afterOrder: number        // exposure once this order is confirmed
  headroom: number | null   // limit − afterOrder; negative when over
  over: boolean
  blocked: boolean          // the database will refuse this user's conversion
  overdue: number
}

export function creditCheck(position: CreditPosition, orderTotal: number, canOverride: boolean): CreditCheck {
  const limit = Number(position.credit_limit) > 0 ? Number(position.credit_limit) : null
  const afterOrder = Number(position.exposure) + Number(orderTotal)
  const over = limit !== null && afterOrder > limit
  return {
    limit,
    afterOrder,
    headroom: limit === null ? null : limit - afterOrder,
    over,
    blocked: over && !canOverride,
    overdue: Number(position.overdue) || 0,
  }
}
