'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'

const supabase = createClient()
import { formatCurrency } from '@/lib/calculations'
import { getCurrentKW } from '@/lib/parser'

interface PayrollRecord {
  id: string
  employee_id: string
  hours: number
  hourly_rate: number
  gross_salary: number
  fees_35_2: number
  total_cost: number
  paid: boolean
  employees: {
    surname: string
    group: string
  }
}

export default function VyplatyPage() {
  const [kw, setKw] = useState(getCurrentKW().kw)
  const [year, setYear] = useState(getCurrentKW().year)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [kw, year])

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll')
        .select('*, employees(surname, group)')
        .eq('kw', kw)
        .eq('year', year)
        .order('employees(surname)')

      if (error) throw error
      setRecords((data || []) as unknown as PayrollRecord[])
      setSelected(new Set())
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const markAsPaid = async () => {
    if (selected.size === 0) return

    try {
      const { error } = await supabase
        .from('payroll')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .in('id', Array.from(selected))

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const exportCSV = () => {
    const headers = ['Priezvisko', 'Skupina', 'Hodiny', 'Sadzba', 'Hrubá mzda', 'Odvody (35.2%)', 'Celk. náklad', 'Vyplatené']
    const rows = records.map(r => [
      r.employees.surname,
      r.employees.group === 'A' ? 'Fitter' : 'Mag zvárač',
      r.hours.toFixed(1),
      r.hourly_rate.toFixed(2),
      r.gross_salary.toFixed(2),
      r.fees_35_2.toFixed(2),
      r.total_cost.toFixed(2),
      r.paid ? 'Áno' : 'Nie',
    ])

    const totalRow = [
      'CELKEM',
      '',
      records.reduce((sum, r) => sum + r.hours, 0).toFixed(1),
      '',
      records.reduce((sum, r) => sum + r.gross_salary, 0).toFixed(2),
      records.reduce((sum, r) => sum + r.fees_35_2, 0).toFixed(2),
      records.reduce((sum, r) => sum + r.total_cost, 0).toFixed(2),
      '',
    ]

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(',')),
      totalRow.map(cell => `"${cell}"`).join(','),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Vyplaty_KW${kw}_${year}.csv`
    link.click()
  }

  if (loading) {
    return <div className="p-8">Načítavanie...</div>
  }

  const totalHours = records.reduce((sum, r) => sum + r.hours, 0)
  const totalGross = records.reduce((sum, r) => sum + r.gross_salary, 0)
  const totalFees = records.reduce((sum, r) => sum + r.fees_35_2, 0)
  const totalCost = records.reduce((sum, r) => sum + r.total_cost, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Výplaty</h1>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Stiahnuť CSV
            </button>
            <button
              onClick={markAsPaid}
              disabled={selected.size === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
            >
              Označiť ako vyplatené ({selected.size})
            </button>
          </div>
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

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === records.length && records.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(records.map(r => r.id)))
                      } else {
                        setSelected(new Set())
                      }
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priezvisko</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Skup.</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Hodiny</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Sadzba</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Hrubá</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Odvody</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Celk.</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Výplata</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-6 py-3 text-sm font-medium">{record.employees.surname}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{record.employees.group}</td>
                  <td className="px-6 py-3 text-sm text-right font-medium">{record.hours.toFixed(1)}</td>
                  <td className="px-6 py-3 text-sm text-right">{formatCurrency(record.hourly_rate)}</td>
                  <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(record.gross_salary)}</td>
                  <td className="px-6 py-3 text-sm text-right">{formatCurrency(record.fees_35_2)}</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold">{formatCurrency(record.total_cost)}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${record.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {record.paid ? 'Áno' : 'Nie'}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold border-t-2">
                <td colSpan={3} className="px-6 py-3 text-right">CELKEM:</td>
                <td className="px-6 py-3 text-right">{totalHours.toFixed(1)}</td>
                <td colSpan={1}></td>
                <td className="px-6 py-3 text-right">{formatCurrency(totalGross)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totalFees)}</td>
                <td className="px-6 py-3 text-right">{formatCurrency(totalCost)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
