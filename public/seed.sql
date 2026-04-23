-- Test data for Herema app
-- Run AFTER schema.sql

-- ── Employees ────────────────────────────────────────────────────────────────

INSERT INTO employees (surname, first_name, "group", hourly_rate, position, active)
VALUES
  ('Varga',  'Jozef', 'A', 22.00, 'Fitter',     true),
  ('Kovac',  'Ján',   'B', 23.00, 'Mag zvárač', true),
  ('Magyar', 'Péter', 'A', 22.00, 'Fitter',     true)
ON CONFLICT (surname) DO NOTHING;

-- ── Aliases ──────────────────────────────────────────────────────────────────
-- Include common variants: lowercase, diacritic-stripped, email-style

INSERT INTO employee_aliases (surname_alias, employee_id)
SELECT alias, e.id
FROM employees e
JOIN (VALUES
  ('Varga',  'varga'),
  ('Varga',  'varga j'),
  ('Kovac',  'kovac'),
  ('Kovac',  'kovác'),
  ('Kovac',  'kov'),
  ('Magyar', 'magyar'),
  ('Magyar', 'magyar p')
) AS a(surname, alias) ON e.surname = a.surname
ON CONFLICT (surname_alias) DO NOTHING;

-- ── Attendance KW17 2026 ─────────────────────────────────────────────────────

INSERT INTO weekly_attendance (kw, year, employee_id, hours)
SELECT 17, 2026, id, 40 FROM employees WHERE surname = 'Varga'
ON CONFLICT (kw, year, employee_id) DO NOTHING;

INSERT INTO weekly_attendance (kw, year, employee_id, hours)
SELECT 17, 2026, id, 38 FROM employees WHERE surname = 'Kovac'
ON CONFLICT (kw, year, employee_id) DO NOTHING;

INSERT INTO weekly_attendance (kw, year, employee_id, hours)
SELECT 17, 2026, id, 40 FROM employees WHERE surname = 'Magyar'
ON CONFLICT (kw, year, employee_id) DO NOTHING;

-- ── Payroll KW17 2026 ────────────────────────────────────────────────────────
-- gross_salary, fees_35_2, total_cost are GENERATED STORED — do not insert them

INSERT INTO payroll (kw, year, employee_id, hours, hourly_rate)
SELECT 17, 2026, e.id, wa.hours, e.hourly_rate
FROM weekly_attendance wa
JOIN employees e ON e.id = wa.employee_id
WHERE wa.kw = 17 AND wa.year = 2026
ON CONFLICT (kw, year, employee_id) DO NOTHING;

-- ── Costs KW17 2026 ──────────────────────────────────────────────────────────

INSERT INTO weekly_costs (kw, year, cost_type, amount, source)
VALUES
  (17, 2026, 'Ubytovanie', 300.00, 'Manual'),
  (17, 2026, 'Letenky',    500.00, 'Manual'),
  (17, 2026, 'Auto',       200.00, 'Manual')
ON CONFLICT (kw, year, cost_type) DO NOTHING;
