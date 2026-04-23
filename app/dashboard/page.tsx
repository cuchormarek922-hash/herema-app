'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { getCurrentKW } from '@/lib/parser'

interface KPIData {
  totalHours: number
  totalLaborCost: number
  activeEmployees: number
  agentStatus: string
}

export default function DashboardPage() {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const { kw, year } = getCurrentKW()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get payroll for current KW
        const { data: payrollData } = await supabase
          .from('payroll')
          .select('hours, total_cost')
          .eq('kw', kw)
          .eq('year', year)

        // Get active employees
        const { data: employeeData } = await supabase
          .from('employees')
          .select('id')
          .eq('active', true)

        // Get latest agent log
        const { data: logData } = await supabase
          .from('agent_logs')
          .select('status')
          .order('timestamp', { ascending: false })
          .limit(1)

        const totalHours = payrollData?.reduce((sum, p) => sum + (p.hours || 0), 0) || 0
        const totalLaborCost = payrollData?.reduce((sum, p) => sum + (p.total_cost || 0), 0) || 0

        setData({
          totalHours,
          totalLaborCost,
          activeEmployees: employeeData?.length || 0,
          agentStatus: logData?.[0]?.status || 'unknown',
        })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [kw, year])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">Načítavanie...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 mb-8">KW {kw} / {year}</p>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Celkové hodiny"
            value={data?.totalHours.toFixed(1) || '0'}
            unit="h"
          />
          <KPICard
            title="Náklady labor"
            value={formatCurrency(data?.totalLaborCost || 0)}
          />
          <KPICard
            title="Aktívni zamestnanci"
            value={String(data?.activeEmployees ?? 0)}
          />
          <KPICard
            title="Status agenta"
            value={data?.agentStatus.toUpperCase() || 'N/A'}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Prehľad</h2>
          <p className="text-gray-600">
            Detaily sa budú zobrazovať po prvom spustení agenta.
          </p>
        </div>
      </div>
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string
  unit?: string
}

function KPICard({ title, value, unit }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-gray-600 text-sm mb-2">{title}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        {unit && <span className="text-lg text-gray-600"> {unit}</span>}
      </p>
    </div>
  )
}
