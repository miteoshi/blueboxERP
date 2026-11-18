'use client'

import { MoneyEntriesPage, type MoneyEntriesConfig } from '@/components/finance/money-entries-page'
import { useCancelOtherIncome, useIncomeHeads, useOtherIncome, useRecordOtherIncome, useSaveIncomeHead } from '@/lib/hooks/use-other-income'
import { HandCoins } from 'lucide-react'

const OTHER_INCOME: MoneyEntriesConfig = {
  title: 'Other Income',
  description: 'Interest, discounts received, scrap sales and other money received that is not a customer payment',
  csvName: 'other-income',
  icon: HandCoins,
  noun: 'income entry',
  nouns: 'income entries',
  numberHeader: 'Income',
  recordLabel: 'Record income',
  saveLabel: 'Save income',
  formTitle: 'Record other income',
  formHint: 'The full amount received. Money from customers against invoices goes in Payments Received instead.',
  amountMissing: 'Enter the amount received',
  dateLabel: 'Income',
  partyLabel: 'Received from',
  partyPlaceholder: 'e.g. bank, scrap dealer',
  notesPlaceholder: 'e.g. savings interest for Q2',
  totalLabel: 'Received in the period',
  totalUnderHead: 'Received under this head',
  cashLabel: 'Received in cash',
  cashSub: 'into the cash box',
  headsTitle: 'Income heads',
  headWord: 'income head',
  newHeadPlaceholder: 'e.g. Insurance claim',
  emptyText: 'No other income in this period',
  footnote:
    'Record the full amount received. It is added to net profit on the Profit & Loss and to your cash or bank balance. GST is not split out here, so if a scrap sale is taxable, raise a tax invoice for it instead.',
  barClass: 'bg-green-500',
  useHeads: useIncomeHeads,
  useEntries: useOtherIncome,
  useRecord: useRecordOtherIncome,
  useCancel: useCancelOtherIncome,
  useSaveHead: useSaveIncomeHead,
}

export default function OtherIncomePage() {
  return <MoneyEntriesPage config={OTHER_INCOME} />
}
