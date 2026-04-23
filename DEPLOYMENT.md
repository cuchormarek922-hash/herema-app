# Nasadenie Herema App

Kompletný návod na nasadenie aplikácie do produkcie na Vercel + Supabase.

## Krok 1: Príprava Supabase

### 1.1 Vytvor Supabase projekt
1. Choď na https://supabase.com
2. Klikni "New Project"
3. Vyplň detaily projektu:
   - **Name**: Herema
   - **Database Password**: Vygeneruj silné heslo
   - **Region**: Europe (France)
4. Čakaj na inicializáciu (~2 min)

### 1.2 Vytvor tabuľky
1. Otvori SQL Editor
2. Skopíruj celý obsah zo súboru `supabase/schema.sql`
3. Vlož do SQL editora a spusti (**Ctrl+Enter**)
4. Čakaj na úspešný výstup

### 1.3 Naplň testovacími dátami (voliteľné)
1. V SQL editore skopíruj obsah `public/seed.sql`
2. Spusti dotaz
3. Teraz máš 3 test zamestnancov a sample dáta

### 1.4 Zisti API kľúče
1. V Supabase choď do **Project Settings** > **API**
2. Kopíruj:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

## Krok 2: Príprava GitHub

### 2.1 Vytvor GitHub repo
1. Choď na https://github.com/new
2. **Repository name**: `herema-app`
3. **Public** (voliteľné)
4. Klikni "Create repository"

### 2.2 Pushni kód
```bash
cd herema-app

# Inicializuj git (ak ešte nie je)
git init
git add .
git commit -m "Initial commit: Herema project management app

Co-Authored-By: Claude <noreply@anthropic.com>"

# Zmeň "username" na tvoj GitHub username
git branch -M main
git remote add origin https://github.com/username/herema-app.git
git push -u origin main
```

## Krok 3: Vercel nasadenie

### 3.1 Prepoj GitHub s Vercel
1. Choď na https://vercel.com
2. Klikni "Import Project"
3. Vyber "GitHub" a prihlás sa
4. Nájdi a vyber repo `herema-app`
5. Klikni "Import"

### 3.2 Nastav environment premenné
1. V Vercel dashboard choď do **Settings** > **Environment Variables**
2. Pridaj tieto premenné (z kroku 1.4):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxx
AGENT_SECRET=tvoje_tajne_heslo_pre_agenta
```

**Tip**: Pre `AGENT_SECRET` vygeneruj náhodné heslo (aspoň 32 znakov)

### 3.3 Spusti deployment
1. Klikni "Deploy"
2. Čakaj na build (1-2 minúty)
3. Po úspechu dostaneš **Production URL** (napr. `herema-app.vercel.app`)

## Krok 4: Vytvorenie prvého používateľa

### 4.1 V Supabase console
1. Choď do **Authentication** > **Users**
2. Klikni "Invite"
3. Vyplň email a klikni "Send invite"
4. Emailová pozvánka príde tebe
5. Klikni na link v emaile a nastav heslo

### 4.2 Prihlásenie
1. Otvori svoju Vercel URL (napr. `https://herema-app.vercel.app`)
2. Prihlás sa s emailom a heslom
3. Mali by si vidieť Dashboard ✓

## Krok 5: Pozvanie kolegov

### 5.1 Vytvor účty v Supabase
1. V Supabase choď **Authentication** > **Users**
2. Klikni "Invite" pre každého kolegov
3. Vyplň ich emaily
4. Oni dostanú emailovú pozvánku

### 5.2 Kolegovia si nastavia heslo
- Oni klikanú na link v emaile
- Nastavia si heslo
- Prihlásia sa pomocou emailu a hesla

## Krok 6: Spustenie weekly agenta

### 6.1 Manuálne (prvé testovanie)
1. Pripraveš email s hodinami:
```
Varga: 40
Kovác: 38
Magyar: 42
```

2. Spustíš curl alebo Postman:
```bash
curl -X POST https://herema-app.vercel.app/api/agent/run \
  -H "Authorization: Bearer tvoje_AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"emailText":"Varga: 40\nKovác: 38\nMagyar: 42"}'
```

3. Odpoveď by mala byť:
```json
{
  "success": true,
  "result": {
    "kw": 17,
    "year": 2026,
    "parsed": 3,
    "payroll": 3
  },
  "logs": [...]
}
```

### 6.2 Automatické spustenie (pg_cron)
Toto nastavenie nie je v MVP. Môžeš ho pridať neskôr s pg_cron na Supabase.

Zatiaľ spustíš agenta manuálne cez API alebo budúcu admin UI.

## Krok 7: Záloha a maintenance

### 7.1 Záloha databázy
- Supabase automaticky zálohuje
- Choď **Backups** v Supabase console
- Môžeš si stiahnutť zálohu ručne

### 7.2 Monitoring
- Vercel: **Analytics** pre performance
- Supabase: **Logs** pre DB errors
- Opravuj buggy prostredníctvom git pushov (automatický redeploy)

## Troubleshooting

### Problem: "Invalid API key"
**Riešenie**: Skontroluj, či sú env premenné správne v Vercel settings

### Problem: "Database connection error"
**Riešenie**: 
- Skontroluj `NEXT_PUBLIC_SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY`
- Vyskúšaj znovu v Supabase SQL editore či tabuľky existujú

### Problem: "Email parser not found"
**Riešenie**: Skontroluj či existujú employee_aliases v databáze

### Problem: Vercel build fail
**Riešenie**: 
1. Skontroluj build logy v Vercel
2. Pustí `npm run build` lokálne
3. Pushni fix cez git

---

## Finálny checkl ist

- [ ] Supabase projekt vytvorený s tabuľkami
- [ ] API kľúče sú v Vercel environment variables
- [ ] GitHub repo je pushnutý
- [ ] Vercel nasadenie je úspešné
- [ ] Prvý používateľ vytvorený a prihlásený
- [ ] Dashboard otvorí bez chýb
- [ ] Kolegovia sú pozvaní a prihlásení
- [ ] Agent test spustený úspešne

---

**Všetko hotovo! 🎉**

Teraz môžeš:
1. Pridávať zamestnancov v `/zamestnanci`
2. Nahrávaš hodinách v `/hodinovy-plan`
3. Spúšťať agenta na `/api/agent/run`
4. Vidieť výplaty v `/vyplaty`
5. Generovať reporty v `/kw-report`

Viac otázok? Kontaktuj admin. 📧
