'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { getCurrentKW } from '@/lib/parser'

interface AttendanceRecord {
  id: string
  employee_id: string
  hours: number
  employees: {
    surname: string
    group: string
    hourly_rate: number
  }
}

export default function HodinovyPlanPage() {
  const [kw, setKw] = useState(getCurrentKW().kw)
  const [year, setYear] = useState(getCurrentKW().year)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<number>(0)

  useEffect(() => {
    fetchData()
  }, [kw, year])

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_attendance')
        .select('id, employee_id, hours, employees(surname, group, hourly_rate)')
        .eq('kw', kw)
        .eq('year', year)
        .order('employees(surname)')

      if (error) throw error
      setRecords((data || []) as AttendanceRecord[])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleHourChange = async (id: string, newHours: number) => {
    try {
      const { error } = await supabase
        .from('weekly_attendance')
        .update({ hours: newHours })
        .eq('id', id)

      if (error) throw error
      setEditingId(null)
      await fetchData()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getHourColor = (hours: number) => {
    if (hours < 40) return 'bg-green-50 border-green-200'
    if (hours <= 45) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  if (loading) {
    return <div className="p-8">Načítavanie...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Hodinový plán</h1>

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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priezvisko</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Skupina</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hodiny</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sadzba</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hrubá mzda</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Žiadne záznamy pre tento týždeň
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className={`border-b ${getHourColor(record.hours)}`}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{record.employees.surname}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${record.employees.group === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {record.employees.group === 'A' ? 'Fitter' : 'Mag'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {editingId === record.id ? (
                        <input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(parseFloat(e.target.value))}
                          onBlur={() => handleHourChange(record.id, editingValue)}
                          className="w-20 px-2 py-1 border rounded"
                          step="0.5"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(record.id)
                            setEditingValue(record.hours)
                          }}
                          className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {record.hours}h
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">{formatCurrency(record.employees.hourly_rate)}</td>
                    <td className="px-6 py-3 text-sm font-medium">
                      {formatCurrency(record.hours * record.employees.hourly_rate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
