import { describe, it, expect } from 'vitest'
import {
  calculateGrossSalary,
  calculateFees,
  calculateTotalCost,
  calculateTotalCostDirect,
  formatCurrency,
  getWeekDates,
} from '../calculations'

describe('calculateGrossSalary', () => {
  it('Fitter: 40h × €22 = €880', () => {
    expect(calculateGrossSalary(40, 22)).toBe(880)
  })
  it('Mag zvárač: 38h × €23 = €874', () => {
    expect(calculateGrossSalary(38, 23)).toBe(874)
  })
  it('rounds to 2 decimal places', () => {
    expect(calculateGrossSalary(37.5, 22)).toBe(825)
  })
})

describe('calculateFees', () => {
  it('€880 × 0.352 = €309.76', () => {
    expect(calculateFees(880)).toBe(309.76)
  })
  it('rounds to 2 decimal places', () => {
    expect(calculateFees(100)).toBe(35.2)
  })
})

describe('calculateTotalCost', () => {
  it('€880 × 1.352 = €1189.76', () => {
    expect(calculateTotalCost(880)).toBe(1189.76)
  })
  it('total = gross + fees', () => {
    const gross = calculateGrossSalary(40, 22)
    expect(calculateTotalCost(gross)).toBe(gross + calculateFees(gross))
  })
})

describe('calculateTotalCostDirect', () => {
  it('produces same result as gross → total chain', () => {
    const hours = 40
    const rate = 22
    const chained = calculateTotalCost(calculateGrossSalary(hours, rate))
    expect(calculateTotalCostDirect(hours, rate)).toBe(chained)
  })
  it('Mag zvárač: 38h × €23 total cost', () => {
    expect(calculateTotalCostDirect(38, 23)).toBe(
      Math.round(38 * 23 * 1.352 * 100) / 100
    )
  })
})

describe('formatCurrency', () => {
  it('formats with EUR symbol', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('€')
  })
  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })
})

describe('getWeekDates', () => {
  it('KW1 2026 starts on a Monday', () => {
    const { start } = getWeekDates(1, 2026)
    expect(start.getDay()).toBe(1) // 1 = Monday
  })
  it('week spans 6 days (Mon–Sun)', () => {
    const { start, end } = getWeekDates(17, 2026)
    const diffMs = end.getTime() - start.getTime()
    expect(diffMs / (1000 * 60 * 60 * 24)).toBe(6)
  })
  it('end day is Sunday', () => {
    const { end } = getWeekDates(17, 2026)
    expect(end.getDay()).toBe(0) // 0 = Sunday
  })
})
