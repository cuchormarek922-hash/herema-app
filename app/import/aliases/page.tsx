'use client'

import { useState, useRef } from 'react'

interface ImportResult {
  employees: number
  created: number
  updated: number
  aliases: number
  errors: string[]
}

export default function AliasImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/import/aliases', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import zlyhal')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import aliasov mien</h1>
          <p className="text-gray-500 text-sm mt-1">
            Nahraj Excel so stĺpcami: <code className="bg-gray-100 px-1 rounded">Alias_z_Emailu</code> ·{' '}
            <code className="bg-gray-100 px-1 rounded">Oficiálne_Meno</code> ·{' '}
            <code className="bg-gray-100 px-1 rounded">ID_Zamestnanca</code>
          </p>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Ako funguje systém rozpoznávania mien:</p>
          <p>🎯 <strong>Vrstva 1</strong> — Exaktná zhoda aliasu (Apostol Ion → Ion Apostol)</p>
          <p>🔤 <strong>Vrstva 2</strong> — Zhoda podľa slov (Apostol I → Ion Apostol)</p>
          <p>🔀 <strong>Vrstva 3</strong> — Fuzzy zhoda ≤2 znaky (Apostoel → Apostol, Turbata → Turbatu)</p>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Vyber Excel súbor s aliasmi
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            disabled={loading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
          />
          {loading && (
            <div className="mt-3 flex items-center gap-2 text-blue-600 text-sm">
              <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Importuje sa...
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-green-200">
              <p className="font-semibold text-green-800">✓ Import aliasov dokončený</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{result.employees}</div>
                <div className="text-sm text-gray-500 mt-1">Zamestnancov celkom</div>
                <div className="text-xs text-gray-400">
                  {result.created} nových · {result.updated} aktualizovaných
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{result.aliases}</div>
                <div className="text-sm text-gray-500 mt-1">Aliasov importovaných</div>
                <div className="text-xs text-gray-400">vrátane normalizovaných variantov</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="px-6 pb-4">
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-600 font-medium">
                    ⚠ {result.errors.length} varovaní
                  </summary>
                  <ul className="mt-2 space-y-1 text-red-700 text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
            <div className="px-6 pb-5 text-sm text-gray-600 bg-gray-50 py-3 border-t border-gray-100">
              ✅ Teraz môžeš importovať Excel súbory s hodinami — mená sa automaticky rozpoznajú.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
