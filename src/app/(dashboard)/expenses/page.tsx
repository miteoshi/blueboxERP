'use client'

import { MoneyEntriesPage, type MoneyEntriesConfig } from '@/components/finance/money-entries-page'
import { useCancelExpense, useExpenseHeads, useExpenses, useRecordExpense, useSaveExpenseHead } from '@/lib/hooks/use-expenses'
import { Receipt } from 'lucide-react'

const EXPENSES: MoneyEntriesConfig = {
  title: 'Expenses',
  description: 'Rent, wages, electricity, freight and other money paid out that is not a supplier bill',
  csvName: 'expenses',
  icon: Receipt,
  noun: 'expense',
  nouns: 'expenses',
  numberHeader: 'Expense',
  recordLabel: 'Record expense',
  saveLabel: 'Save expense',
  formTitle: 'Record an expense',
  formHint: 'The full amount paid, including any GST.',
  amountMissing: 'Enter the amount paid',
  dateLabel: 'Expense',
  partyLabel: 'Paid to',
  partyPlaceholder: 'e.g. landlord, transporter',
  notesPlaceholder: 'e.g. November rent, bill no. 4521',
  totalLabel: 'Spent in the period',
  totalUnderHead: 'Spent under this head',
  cashLabel: 'Paid in cash',
  cashSub: 'out of the cash box',
  headsTitle: 'Expense heads',
  headWord: 'expense head',
  newHeadPlaceholder: 'e.g. Diesel and fuel',
  emptyText: 'No expenses in this period',
  footnote:
    'Record the full amount paid. GST on an expense is not split out here, so it is not counted as input credit in the GST position — claim it through a supplier bill if the supplier is registered and you want the credit.',
  barClass: 'bg-blue-500',
  useHeads: useExpenseHeads,
  useEntries: useExpenses,
  useRecord: useRecordExpense,
  useCancel: useCancelExpense,
  useSaveHead: useSaveExpenseHead,
}

export default function ExpensesPage() {
  return <MoneyEntriesPage config={EXPENSES} />
}
