'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { getCurrentKW } from '@/lib/parser'

interface CostRecord {
  id: string
  cost_type: string
  amount: number
  source: string
}

const COST_TYPES = ['Ubytovanie', 'Letenky', 'Auto', 'PHM', 'SCC']

export default function NakладyPage() {
  const [kw, setKw] = useState(getCurrentKW().kw)
  const [year, setYear] = useState(getCurrentKW().year)
  const [costs, setCosts] = useState<CostRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    cost_type: 'Ubytovanie',
    amount: 0,
  })

  useEffect(() => {
    fetchCosts()
  }, [kw, year])

  const fetchCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_costs')
        .select('*')
        .eq('kw', kw)
        .eq('year', year)
        .order('cost_type')

      if (error) throw error
      setCosts(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase.from('weekly_costs').upsert(
        {
          kw,
          year,
          cost_type: formData.cost_type,
          amount: parseFloat(formData.amount.toString()),
          source: 'Manual',
        },
        { onConflict: 'kw,year,cost_type' }
      )

      if (error) throw error
      setFormData({ cost_type: 'Ubytovanie', amount: 0 })
      await fetchCosts()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const deleteCost = async (id: string) => {
    try {
      const { error } = await supabase.from('weekly_costs').delete().eq('id', id)

      if (error) throw error
      await fetchCosts()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) {
    return <div className="p-8">Načítavanie...</div>
  }

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Náklady</h1>

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

        {/* Add Cost Form */}
        <form onSubmit={handleAddCost} className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pridať náklad</h2>
          <div className="flex gap-4">
            <select
              value={formData.cost_type}
              onChange={(e) => setFormData({ ...formData, cost_type: e.target.value })}
              className="flex-1 px-4 py-2 border rounded-lg"
            >
              {COST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Suma (€)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              step="0.01"
              className="px-4 py-2 border rounded-lg w-32"
              required
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
            >
              Pridať
            </button>
          </div>
        </form>

        {/* Costs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Typ nákladu</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Suma</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Zdroj</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Akcia</th>
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Žiadne náklady pre tento týždeň
                  </td>
                </tr>
              ) : (
                <>
                  {costs.map((cost) => (
                    <tr key={cost.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{cost.cost_type}</td>
                      <td className="px-6 py-3 text-sm font-semibold">{formatCurrency(cost.amount)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{cost.source}</td>
                      <td className="px-6 py-3 text-sm">
                        <button
                          onClick={() => deleteCost(cost.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Odstrániť
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold border-t-2">
                    <td className="px-6 py-3 text-right">CELKEM:</td>
                    <td className="px-6 py-3 text-sm">{formatCurrency(totalCosts)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
