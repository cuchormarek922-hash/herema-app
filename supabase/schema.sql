-- Herema Project Management System - Database Schema

-- =====================
-- CORE TABLES
-- =====================

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surname TEXT NOT NULL UNIQUE,
  first_name TEXT,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  hourly_rate DECIMAL(8,2) NOT NULL,
  position TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Aliases (for email parser)
CREATE TABLE IF NOT EXISTS employee_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surname_alias TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly Attendance
CREATE TABLE IF NOT EXISTS weekly_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kw INTEGER NOT NULL CHECK (kw >= 1 AND kw <= 52),
  year INTEGER NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  hours DECIMAL(5,1) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kw, year, employee_id)
);

-- Weekly Costs
CREATE TABLE IF NOT EXISTS weekly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kw INTEGER NOT NULL CHECK (kw >= 1 AND kw <= 52),
  year INTEGER NOT NULL,
  cost_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  source TEXT DEFAULT 'Manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kw, year, cost_type)
);

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kw INTEGER NOT NULL CHECK (kw >= 1 AND kw <= 52),
  year INTEGER NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  hours DECIMAL(5,1) NOT NULL,
  hourly_rate DECIMAL(8,2) NOT NULL,
  gross_salary DECIMAL(10,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  fees_35_2 DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(hours * hourly_rate * 0.352, 2)) STORED,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(hours * hourly_rate * 1.352, 2)) STORED,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kw, year, employee_id)
);

-- Agent Queue (email submissions waiting for the Monday cron)
CREATE TABLE IF NOT EXISTS agent_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_text    TEXT NOT NULL,
  csv_text      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

ALTER TABLE agent_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_all" ON agent_queue FOR ALL USING (auth.role() = 'authenticated');

-- Agent Logs
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" TIMESTAMPTZ DEFAULT NOW(),
  kw INTEGER,
  year INTEGER,
  step TEXT,
  status TEXT CHECK (status IN ('ok', 'warning', 'error')),
  message TEXT,
  data JSONB
);

-- KW Reports
CREATE TABLE IF NOT EXISTS kw_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kw INTEGER NOT NULL CHECK (kw >= 1 AND kw <= 52),
  year INTEGER NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  total_hours DECIMAL(8,1),
  total_labor_cost DECIMAL(12,2),
  total_other_costs DECIMAL(10,2),
  total_all_costs DECIMAL(12,2),
  warnings JSONB,
  prev_kw_comparison JSONB,
  full_data JSONB,
  UNIQUE(kw, year)
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kw_reports ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users see all
CREATE POLICY "auth_users_all" ON employees FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON employee_aliases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON weekly_attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON weekly_costs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON payroll FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON agent_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_users_all" ON kw_reports FOR ALL USING (auth.role() = 'authenticated');

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_employee_aliases_surname ON employee_aliases(surname_alias);
CREATE INDEX idx_weekly_attendance_employee ON weekly_attendance(employee_id);
CREATE INDEX idx_weekly_attendance_kw_year ON weekly_attendance(kw, year);
CREATE INDEX idx_payroll_employee ON payroll(employee_id);
CREATE INDEX idx_payroll_kw_year ON payroll(kw, year);
CREATE INDEX idx_weekly_costs_kw_year ON weekly_costs(kw, year);
CREATE INDEX idx_kw_reports_kw_year ON kw_reports(kw, year);
