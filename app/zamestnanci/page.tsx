'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'

const supabase = createClient()

interface Employee {
  id: string
  surname: string
  first_name: string
  group: string
  hourly_rate: number
  position: string
  active: boolean
}

export default function ZamestnancIPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    surname: '',
    first_name: '',
    group: 'A',
    hourly_rate: 22,
    position: '',
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('surname')

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase.from('employees').insert({
        ...formData,
        hourly_rate: parseFloat(formData.hourly_rate.toString()),
      })

      if (error) throw error

      setFormData({
        surname: '',
        first_name: '',
        group: 'A',
        hourly_rate: 22,
        position: '',
      })
      setShowForm(false)
      await fetchEmployees()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ active: !active })
        .eq('id', id)

      if (error) throw error
      await fetchEmployees()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) {
    return <div className="p-8">Načítavanie...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Zamestnanci</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            {showForm ? 'Zrušiť' : 'Pridať'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Priezvisko"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Meno"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <select
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="A">Fitter (€22/h)</option>
                <option value="B">Mag zvárač (€23/h)</option>
              </select>
              <input
                type="number"
                placeholder="Sadzba (€/h)"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                step="0.01"
                className="px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Pozícia"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="px-4 py-2 border rounded-lg col-span-2"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
            >
              Uložiť
            </button>
          </form>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priezvisko</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Meno</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Skupina</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sadzba</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Pozícia</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{emp.surname}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{emp.first_name}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${emp.group === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {emp.group === 'A' ? 'Fitter' : 'Mag zvárač'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">€{emp.hourly_rate.toFixed(2)}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{emp.position}</td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      onClick={() => toggleActive(emp.id, emp.active)}
                      className={`px-3 py-1 rounded text-xs ${emp.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                    >
                      {emp.active ? 'Aktívny' : 'Neaktívny'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
