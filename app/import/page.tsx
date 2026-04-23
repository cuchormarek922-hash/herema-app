'use client'

import { useState, useRef } from 'react'

interface Employee {
  fullName: string
  surname: string
  firstName: string
  rate: number
  group: 'A' | 'B'
}

interface Attendance {
  employeeName: string
  kw: number
  year: number
  hours: number
}

interface Cost {
  kw: number
  year: number
  costType: string
  amount: number
}

interface ParseResult {
  year: number
  employees: Employee[]
  attendance: Attendance[]
  costs: Cost[]
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resolvedBy, setResolvedBy] = useState<Record<string, string>>({})

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
    setResult(null)
    setSuccess('')
    setParsing(true)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/import/excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba pri čítaní')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať súbor')
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!result) return
    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/import/excel/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import zlyhal')

      const errs = data.errors?.length ? ` (${data.errors.length} chýb)` : ''
      setSuccess(
        `✓ Import dokončený: ${data.employees} zamestnancov · ${data.attendance} dochádzok · ${data.costs} nákladov${errs}`
      )
      setResolvedBy(data.resolvedBy ?? {})
      setResult(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba pri importe')
    } finally {
      setImporting(false)
    }
  }

  const totalHours = result?.attendance.reduce((s, a) => s + a.hours, 0) ?? 0
  const totalCosts = result?.costs.reduce((s, c) => s + c.amount, 0) ?? 0

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import z Excelu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Nahraj historický Excel (formát Herema calculation). Dáta sa automaticky rozpoznajú.
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">Vyber Excel súbor (.xlsx)</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
            />
          </label>
          {file && !parsing && (
            <p className="mt-2 text-sm text-gray-500">📎 {file.name}</p>
          )}
          {parsing && (
            <p className="mt-3 text-blue-600 text-sm flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Číta sa súbor...
            </p>
          )}
        </div>

        {/* Errors */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
            <div className="px-4 py-4 text-center font-medium text-green-700">{success}</div>
            {Object.keys(resolvedBy).length > 0 && (
              <div className="border-t border-green-200 px-4 py-3">
                <p className="text-xs font-semibold text-green-800 mb-2">Rozpoznanie mien:</p>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(resolvedBy).map(([name, method]) => (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                        method === 'exact' ? 'bg-green-200 text-green-800' :
                        method === 'word' ? 'bg-blue-200 text-blue-800' :
                        method === 'fuzzy' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {method === 'exact' ? '✓ alias' : method === 'word' ? '~ slovo' : method === 'fuzzy' ? '≈ fuzzy' : '+ nový'}
                      </span>
                      <span className="text-gray-700">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Zamestnanci', value: result.employees.length, color: 'blue' },
                { label: 'Záznamy hodín', value: `${result.attendance.length} (${totalHours.toFixed(1)}h)`, color: 'indigo' },
                { label: 'Náklady', value: `${result.costs.length} (${totalCosts.toFixed(2)} €)`, color: 'purple' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Employees table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Zamestnanci ({result.employees.length})</h2>
                <p className="text-xs text-gray-500 mt-0.5">Priezvisko = prvé slovo. Skontroluj a uprav po importe v /zamestnanci.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Celé meno (Excel)', 'Priezvisko', 'Meno', 'Sadzba', 'Skupina'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.employees.map((emp, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-600">{emp.fullName}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{emp.surname}</td>
                        <td className="px-4 py-2.5 text-gray-600">{emp.firstName}</td>
                        <td className="px-4 py-2.5 font-medium">
                          {emp.rate} €/h
                          {emp.rate === 23 && <span className="ml-1 text-xs text-gray-400">(default)</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            emp.group === 'A'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {emp.group}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Hodiny — {result.attendance.length} záznamov</h2>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Zamestnanec', 'KW', 'Rok', 'Hodiny'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.attendance.map((att, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-800">{att.employeeName}</td>
                        <td className="px-4 py-2.5 font-medium">KW{String(att.kw).padStart(2, '0')}</td>
                        <td className="px-4 py-2.5 text-gray-500">{att.year}</td>
                        <td className="px-4 py-2.5 font-semibold text-right">
                          <span className={att.hours > 45 ? 'text-red-600' : att.hours >= 40 ? 'text-yellow-600' : 'text-green-700'}>
                            {att.hours}h
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Costs table */}
            {result.costs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Náklady — {result.costs.length} záznamov</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Náklady z KW5-6 sú rozdelené proporcionálne podľa hodín.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['KW', 'Typ', 'Suma'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.costs.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium">KW{String(c.kw).padStart(2, '0')}</td>
                          <td className="px-4 py-2.5 text-gray-700">{c.costType}</td>
                          <td className="px-4 py-2.5 font-semibold text-right">{c.amount.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={2} className="px-4 py-2.5 font-medium text-gray-600 text-right">Celkom:</td>
                        <td className="px-4 py-2.5 font-bold text-right">{totalCosts.toFixed(2)} €</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Import button */}
            <div className="flex justify-end pb-8">
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold px-10 py-3 rounded-xl transition text-base flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importuje sa...
                  </>
                ) : (
                  '✓ Importovať do databázy'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
