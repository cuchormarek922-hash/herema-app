'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'

const supabase = createClient()
import { formatCurrency } from '@/lib/calculations'
import { getCurrentKW } from '@/lib/parser'

interface ReportData {
  kw: number
  year: number
  total_hours: number
  total_labor_cost: number
  total_other_costs: number
  total_all_costs: number
  full_data: any
}

export default function KWReportPage() {
  const [kw, setKw] = useState(getCurrentKW().kw)
  const [year, setYear] = useState(getCurrentKW().year)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReport()
  }, [kw, year])

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from('kw_reports')
        .select('*')
        .eq('kw', kw)
        .eq('year', year)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }
      setReport(data as ReportData || null)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    try {
      setLoading(true)

      const { data: payroll } = await supabase
        .from('payroll')
        .select('*, employees(surname)')
        .eq('kw', kw)
        .eq('year', year)

      const { data: costs } = await supabase
        .from('weekly_costs')
        .select('*')
        .eq('kw', kw)
        .eq('year', year)

      const totalHours = payroll?.reduce((sum, p) => sum + (p.hours || 0), 0) || 0
      const totalLaborCost = payroll?.reduce((sum, p) => sum + (p.total_cost || 0), 0) || 0
      const totalOtherCosts = costs?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      const { error } = await supabase.from('kw_reports').upsert({
        kw,
        year,
        total_hours: totalHours,
        total_labor_cost: totalLaborCost,
        total_other_costs: totalOtherCosts,
        total_all_costs: totalLaborCost + totalOtherCosts,
        full_data: {
          payroll,
          costs,
        },
      })

      if (error) throw error
      await fetchReport()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Načítavanie...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Report KW</h1>
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
          >
            Regenerovať
          </button>
        </div>

        <div className="flex gap-4 mb-8">
          <select
            value={kw}
            onChange={(e) => setKw(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                KW {w}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {report ? (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Celkové hodiny"
                value={report.total_hours.toFixed(1)}
                unit="h"
              />
              <SummaryCard
                title="Náklady práca"
                value={formatCurrency(report.total_labor_cost)}
              />
              <SummaryCard
                title="Ostatné náklady"
                value={formatCurrency(report.total_other_costs)}
              />
              <SummaryCard
                title="CELKEM"
                value={formatCurrency(report.total_all_costs)}
                highlight
              />
            </div>

            {/* Payroll Table */}
            {report.full_data?.payroll && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Prehľad hodín</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left">Priezvisko</th>
                        <th className="px-4 py-2 text-right">Hodiny</th>
                        <th className="px-4 py-2 text-right">Sadzba</th>
                        <th className="px-4 py-2 text-right">Hrubá mzda</th>
                        <th className="px-4 py-2 text-right">Odvody</th>
                        <th className="px-4 py-2 text-right">Celk. náklad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.full_data.payroll.map((p: any) => (
                        <tr key={p.id} className="border-b">
                          <td className="px-4 py-2">{p.employees.surname}</td>
                          <td className="px-4 py-2 text-right">{p.hours.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(p.hourly_rate)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.gross_salary)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(p.fees_35_2)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Costs Table */}
            {report.full_data?.costs && report.full_data.costs.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Náklady</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left">Typ</th>
                        <th className="px-4 py-2 text-right">Suma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.full_data.costs.map((c: any) => (
                        <tr key={c.id} className="border-b">
                          <td className="px-4 py-2">{c.cost_type}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Žiaden report pre tento týždeň</p>
            <button
              onClick={generateReport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Vytvoriť report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  unit?: string
  highlight?: boolean
}

function SummaryCard({ title, value, unit, highlight }: SummaryCardProps) {
  return (
    <div className={`rounded-lg shadow p-6 ${highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-white'}`}>
      <p className="text-gray-600 text-sm mb-2">{title}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-900' : 'text-gray-900'}`}>
        {value}
        {unit && <span className="text-lg text-gray-600"> {unit}</span>}
      </p>
    </div>
  )
}
