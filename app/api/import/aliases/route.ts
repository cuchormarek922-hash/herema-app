import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/server'
import { normalizeName } from '@/lib/nameResolver'



function getField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key]
  }
  return undefined
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await (await createServerClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Žiadny súbor' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    // Find sheet with alias data (prefer sheet named with "alias", else first sheet)
    const sheetName =
      wb.SheetNames.find((n) => n.toLowerCase().includes('alias')) ?? wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Prázdny list alebo nesprávny formát' }, { status: 400 })
    }

    // Group rows by external ID
    const empMap = new Map<
      number,
      { officialName: string; aliases: Set<string> }
    >()

    for (const row of rows) {
      const alias = String(
        getField(row, 'Alias_z_Emailu', 'alias', 'Alias') ?? ''
      ).trim()
      const officialName = String(
        getField(row, 'Oficiálne_Meno', 'Oficialne_Meno', 'Meno', 'official') ?? ''
      ).trim()
      const externalId = Number(
        getField(row, 'ID_Zamestnanca', 'ID', 'id') ?? 0
      )

      if (!alias || !officialName || !externalId) continue

      if (!empMap.has(externalId)) {
        empMap.set(externalId, { officialName, aliases: new Set() })
      }
      // Always add the alias; also add the official name itself as an alias
      empMap.get(externalId)!.aliases.add(alias)
      empMap.get(externalId)!.aliases.add(officialName)
    }

    let empCreated = 0
    let empUpdated = 0
    let aliasCount = 0
    const errors: string[] = []

    for (const [externalId, { officialName, aliases }] of empMap) {
      // Parse official name: "Ion Apostol" → surname=last word, firstName=rest
      const parts = officialName.trim().split(/\s+/)
      const surname = parts[parts.length - 1]
      const firstName = parts.slice(0, -1).join(' ')

      let empId: string | null = null

      // ── Find existing employee by surname + firstName ──────────────────
      const { data: exactMatch } = await supabase
        .from('employees')
        .select('id')
        .eq('surname', surname)
        .eq('first_name', firstName)
        .maybeSingle()

      if (exactMatch) {
        empId = exactMatch.id
        empUpdated++
      } else {
        // Check if surname is already taken by a different person
        const { data: surnameConflict } = await supabase
          .from('employees')
          .select('id, first_name')
          .eq('surname', surname)
          .maybeSingle()

        // Disambiguate: "Apostol" taken by Ion → "Apostol M" for Mihai
        let useSurname = surname
        if (surnameConflict && surnameConflict.first_name !== firstName) {
          const initial = firstName.charAt(0).toUpperCase()
          useSurname = `${surname} ${initial}`
        }

        const { data: created, error: createErr } = await supabase
          .from('employees')
          .upsert(
            {
              surname: useSurname,
              first_name: firstName,
              group: 'A',
              hourly_rate: 22,
              position: 'Worker',
              active: true,
            },
            { onConflict: 'surname' }
          )
          .select('id')
          .single()

        if (createErr || !created) {
          errors.push(`${officialName} (ID ${externalId}): ${createErr?.message ?? 'unknown'}`)
          continue
        }
        empId = created.id
        empCreated++
      }

      // ── Upsert all aliases (including normalized variants) ────────────
      const aliasSet = new Set<string>()
      for (const alias of aliases) {
        aliasSet.add(alias.toLowerCase().trim())
        // Also add normalized variant (strips accents + punctuation)
        aliasSet.add(normalizeName(alias))
      }

      for (const aliasStr of aliasSet) {
        if (!aliasStr || aliasStr.length < 2) continue
        const { error: aliasErr } = await supabase
          .from('employee_aliases')
          .upsert(
            { surname_alias: aliasStr, employee_id: empId },
            { onConflict: 'surname_alias' }
          )
        if (!aliasErr) aliasCount++
        else if (!aliasErr.message.includes('unique')) {
          errors.push(`Alias "${aliasStr}": ${aliasErr.message}`)
        }
      }
    }

    return NextResponse.json({
      employees: empCreated + empUpdated,
      created: empCreated,
      updated: empUpdated,
      aliases: aliasCount,
      errors,
    })
  } catch (err) {
    console.error('Alias import error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
