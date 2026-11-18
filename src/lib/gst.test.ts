import { describe, expect, it } from 'vitest'
import { amountInWords, financialYear, gstinError, isValidGstin, normalizeGstin, setOffInputCredit, stateCodeFromGstin, type TaxHeads } from './gst'

describe('GSTIN', () => {
  it.each(['27AAPFU0939F1ZV', '24AAPFU0939F1Z1', '24AABCB1234C1ZK', '27AABCB1234C1ZE'])('accepts %s (check character matches)', (g) => {
    expect(isValidGstin(g)).toBe(true)
  })

  it('accepts lower case and spaces, as typed', () => {
    expect(normalizeGstin(' 27aapfu 0939f1zv ')).toBe('27AAPFU0939F1ZV')
    expect(isValidGstin('27aapfu0939f1zv')).toBe(true)
  })

  it.each(['27AAPFU0939F1ZA', '2AAPFU0939F1ZV', 'XXAAPFU0939F1ZV', ''])('rejects %j', (g) => {
    expect(isValidGstin(g)).toBe(false)
  })

  it('explains what is wrong', () => {
    expect(gstinError('')).toBeNull()
    expect(gstinError('27AAPFU0939F1ZV')).toBeNull()
    expect(gstinError('27AAPFU')).toBe('GSTIN has 15 characters (7 entered)')
    expect(gstinError('27AAPFU0939F1ZA')).toMatch(/last character/)
  })

  it('reads the state code only from a valid GSTIN', () => {
    expect(stateCodeFromGstin('24AABCB1234C1ZK')).toBe('24')
    expect(stateCodeFromGstin('24AABCB1234C1ZZ')).toBeNull()
  })
})

describe('amountInWords', () => {
  it.each([
    [1522.5, 'Rupees One Thousand Five Hundred Twenty Two and Fifty Paise Only'],
    [0, 'Rupees Zero Only'],
    [100000, 'Rupees One Lakh Only'],
    [12345678.05, 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Five Paise Only'],
    [1000000000, 'Rupees One Hundred Crore Only'],
    [-590, 'Minus Rupees Five Hundred Ninety Only'],
    [0.999, 'Rupees One Only'],
  ])('%d', (amount, words) => {
    expect(amountInWords(amount)).toBe(words)
  })
})

describe('financialYear', () => {
  it('runs April to March', () => {
    expect(financialYear('2026-03-31')).toEqual({ label: '25-26', from: '2025-04-01', to: '2026-03-31' })
    expect(financialYear('2026-04-01')).toEqual({ label: '26-27', from: '2026-04-01', to: '2027-03-31' })
    expect(financialYear('2099-12-01').label).toBe('99-00')
  })
})

describe('setOffInputCredit (section 49(5), rule 88A)', () => {
  const T = (igst: number, cgst: number, sgst: number): TaxHeads => ({ igst, cgst, sgst })

  it('IGST credit pays IGST first, then CGST and SGST', () => {
    const r = setOffInputCredit(T(1000, 500, 500), T(1200, 0, 0))
    expect(r.setOff).toEqual(T(1000, 200, 0))
    expect(r.cash).toEqual(T(0, 300, 500))
    expect(r.carriedForward).toEqual(T(0, 0, 0))
  })

  it('CGST credit never pays SGST', () => {
    const r = setOffInputCredit(T(0, 100, 100), T(0, 300, 0))
    expect(r.cash).toEqual(T(0, 0, 100))
    expect(r.carriedForward).toEqual(T(0, 200, 0))
  })

  it('CGST and SGST credit can pay IGST', () => {
    const r = setOffInputCredit(T(100, 0, 0), T(0, 60, 60))
    expect(r.cash).toEqual(T(0, 0, 0))
    expect(r.carriedForward).toEqual(T(0, 0, 20))
  })

  it('left-over IGST credit goes where the head’s own credit falls short', () => {
    const r = setOffInputCredit(T(0, 100, 100), T(100, 100, 0))
    expect(r.cash).toEqual(T(0, 0, 0))
    expect(r.carriedForward).toEqual(T(0, 0, 0))
  })

  it('a negative credit (returns exceed purchases) is added to the tax due', () => {
    const r = setOffInputCredit(T(0, 0, 0), T(0, -50, 0))
    expect(r.due).toEqual(T(0, 50, 0))
    expect(r.cash).toEqual(T(0, 50, 0))
  })

  it('a negative output has nothing due', () => {
    expect(setOffInputCredit(T(-20, 0, 0), T(0, 0, 0)).due).toEqual(T(0, 0, 0))
  })

  it('works in whole paise', () => {
    expect(setOffInputCredit(T(0.3, 0, 0), T(0.1, 0, 0)).cash.igst).toBe(0.2)
  })

  it('always balances: due = set off + cash, and credit = used + carried forward', () => {
    let seed = 7
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return Math.round((seed / 2147483648) * 200000) / 100 - 300
    }
    for (let i = 0; i < 500; i++) {
      const output = T(rand(), rand(), rand())
      const credit = T(rand(), rand(), rand())
      const r = setOffInputCredit(output, credit)
      const usedFrom = { igst: 0, cgst: 0, sgst: 0 }
      for (const h of ['igst', 'cgst', 'sgst'] as const) {
        expect(Math.round((r.setOff[h] + r.cash[h]) * 100)).toBe(Math.round(r.due[h] * 100))
        expect(r.cash[h]).toBeGreaterThanOrEqual(0)
        expect(r.carriedForward[h]).toBeGreaterThanOrEqual(0)
        usedFrom[h] = Math.max(0, credit[h]) - r.carriedForward[h]
        expect(usedFrom[h]).toBeGreaterThanOrEqual(-0.001)
      }
      const totalSetOff = r.setOff.igst + r.setOff.cgst + r.setOff.sgst
      expect(Math.round(totalSetOff * 100)).toBe(Math.round((usedFrom.igst + usedFrom.cgst + usedFrom.sgst) * 100))
      // SGST credit never ends up against CGST: CGST set off is covered by IGST and CGST credit alone
      expect(r.setOff.cgst).toBeLessThanOrEqual(usedFrom.igst + usedFrom.cgst + 0.001)
      expect(r.setOff.sgst).toBeLessThanOrEqual(usedFrom.igst + usedFrom.sgst + 0.001)
      // IGST credit is used up before CGST or SGST credit is touched
      if (r.carriedForward.igst > 0) expect(usedFrom.cgst + usedFrom.sgst).toBeLessThanOrEqual(0.001)
    }
  })
})
