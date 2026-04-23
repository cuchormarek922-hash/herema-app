const FEE_COEFFICIENT = 0.352
const TOTAL_COST_COEFFICIENT = 1.352

export function calculateGrossSalary(hours: number, hourlyRate: number): number {
  return Math.round(hours * hourlyRate * 100) / 100
}

export function calculateFees(grossSalary: number): number {
  return Math.round(grossSalary * FEE_COEFFICIENT * 100) / 100
}

export function calculateTotalCost(grossSalary: number): number {
  return Math.round(grossSalary * TOTAL_COST_COEFFICIENT * 100) / 100
}

export function calculateTotalCostDirect(hours: number, hourlyRate: number): number {
  return Math.round(hours * hourlyRate * TOTAL_COST_COEFFICIENT * 100) / 100
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

export function getWeekDates(kw: number, year: number): { start: Date; end: Date } {
  const simple = new Date(year, 0, 1 + (kw - 1) * 7)
  const d = new Date(Date.UTC(simple.getFullYear(), simple.getMonth(), simple.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1)

  const start = new Date(d)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)

  return { start, end }
}
