-- =============================================================================
-- RecruitScout - Complete Database Schema
-- Run this file in your Supabase SQL Editor (or psql) to create all tables.
-- Order matters: tables referenced by FK must come first.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";   -- needed for the BulkQueue webhook trigger

-- =============================================================================
-- 1. jobs
--    Core table — every scraped job listing lands here.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id              TEXT        PRIMARY KEY,
  title           TEXT        NOT NULL,
  company         TEXT        NOT NULL,
  companydomain   TEXT,
  location        TEXT,
  employmenttype  TEXT,
  url             TEXT        NOT NULL,
  dateposted      TEXT,
  salary          TEXT,
  source          TEXT        NOT NULL,
  extractedat     TEXT        NOT NULL,
  status          TEXT,
  description     TEXT,
  worker_id       TEXT,
  category        TEXT,
  client          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public.jobs FOR ALL USING (true);


-- =============================================================================
-- 2. clients
--    Google Sheets / Apps Script configurations per recruitment client.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  apps_script_url TEXT        NOT NULL,
  spreadsheet_id  TEXT,
  sheet_name      TEXT        DEFAULT 'Sheet1',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public.clients FOR ALL USING (true);


-- =============================================================================
-- 3. BulkQueue
--    Distributed task queue — each row is one search job title to scrape.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."BulkQueue" (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  assigned_to     TEXT,
  location        TEXT,
  client_id       UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  target_site     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

ALTER TABLE public."BulkQueue" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public."BulkQueue" FOR ALL USING (true);


-- =============================================================================
-- 4. ActiveAgents
--    Heartbeat table — each connected extension instance pings this table.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."ActiveAgents" (
  worker_id       TEXT        PRIMARY KEY,
  worker_name     TEXT        NOT NULL DEFAULT 'Anonymous Node',
  last_ping       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public."ActiveAgents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public."ActiveAgents" FOR ALL USING (true);


-- =============================================================================
-- 5. Spanish_Companies
--    Whitelist of company names for the Spanish Indeed scraper filter.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."Spanish_Companies" (
  id              BIGSERIAL   PRIMARY KEY,
  "Compan_Names"  TEXT        NOT NULL
);

ALTER TABLE public."Spanish_Companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON public."Spanish_Companies" FOR SELECT USING (true);


-- =============================================================================
-- 6. user_integrations
--    Per-user credentials for third-party integrations (e.g. Blue.cc).
--    Requires Supabase Auth -- references auth.users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bluecc_token_id TEXT,
  bluecc_secret_id TEXT,
  bluecc_company_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);


-- =============================================================================
-- 7. Trigger: notify when the entire BulkQueue is drained
--    Calls the 'queue-webhook' Edge Function via pg_net.
--    Update the URL below to match your self-hosted Supabase instance.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_queue_completion()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INT;
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status IN ('pending', 'running') THEN
    SELECT COUNT(*) INTO pending_count
    FROM public."BulkQueue"
    WHERE status IN ('pending', 'running');

    IF pending_count = 0 THEN
      PERFORM net.http_post(
        -- REPLACE with your self-hosted Supabase URL:
        url     := 'http://YOUR_SERVER_IP:8000/functions/v1/queue-webhook',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer recruitscout-secret-key-123'
        ),
        body    := jsonb_build_object('event', 'queue_completed')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_queue_completion ON public."BulkQueue";

CREATE TRIGGER on_queue_completion
  AFTER UPDATE ON public."BulkQueue"
  FOR EACH ROW
  EXECUTE FUNCTION public.check_queue_completion();
