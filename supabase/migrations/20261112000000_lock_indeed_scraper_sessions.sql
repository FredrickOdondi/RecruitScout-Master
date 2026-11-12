-- =============================================================================
-- Hand out Indeed scraper sessions one at a time, with leases and rotation.
--
-- The extension calls these functions with its normal key (no extra sign-in):
--   claim_indeed_session         -> loads the least-recently-used free account
--   renew_indeed_session         -> keeps it after a successful task
--   report_indeed_session_error  -> counts a block; 3 in a row marks it blocked
--   release_indeed_session       -> gives it back when the queue is done
--
-- Direct SELECTs on the table are turned off, so the whole table (every token)
-- can no longer be downloaded in one request. Note that anyone holding the
-- extension's public key can still call claim_indeed_session and receive one
-- account's cookies, same as any other client of these functions.
-- =============================================================================

-- 1. No direct table reads with the public key --------------------------------
ALTER TABLE public.indeed_scraper_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.indeed_scraper_sessions FROM anon, authenticated;

-- A status for sessions that keep getting blocked. The new value is only
-- referenced inside function bodies, so it is safe to add in this transaction.
ALTER TYPE public.scraper_session_status ADD VALUE IF NOT EXISTS 'blocked';

-- 2. Lease columns -------------------------------------------------------------
ALTER TABLE public.indeed_scraper_sessions
  ADD COLUMN IF NOT EXISTS leased_by    TEXT,
  ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ;

-- 3. Claim the least-recently-used free session ------------------------------
--    Releases anything this worker already holds first. p_exclude skips one
--    session (the one that was just blocked) when rotating.
CREATE OR REPLACE FUNCTION public.claim_indeed_session(
  p_worker_id     TEXT,
  p_lease_minutes INT  DEFAULT 30,
  p_exclude       UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, account_label TEXT, cookies_payload JSONB, leased_until TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET leased_by = NULL, leased_until = NULL
   WHERE s.leased_by = p_worker_id;

  SELECT s.id INTO v_id
    FROM public.indeed_scraper_sessions s
   WHERE s.status = 'active'
     AND (s.leased_until IS NULL OR s.leased_until < NOW())
     AND (p_exclude IS NULL OR s.id <> p_exclude)
   ORDER BY s.last_used_at ASC NULLS FIRST
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.indeed_scraper_sessions s
     SET leased_by    = p_worker_id,
         leased_until = NOW() + make_interval(mins => p_lease_minutes),
         last_used_at = NOW(),
         updated_at   = NOW()
   WHERE s.id = v_id
  RETURNING s.id, s.account_label, s.cookies_payload, s.leased_until;
END;
$$;

-- 4. Renew a lease after a successful task (also clears the error streak) ----
CREATE OR REPLACE FUNCTION public.renew_indeed_session(
  p_session_id    UUID,
  p_worker_id     TEXT,
  p_lease_minutes INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET leased_until = NOW() + make_interval(mins => p_lease_minutes),
         last_used_at = NOW(),
         error_count  = 0,
         updated_at   = NOW()
   WHERE s.id = p_session_id
     AND s.leased_by = p_worker_id
     AND s.status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- 5. Report a block: bump the error streak, release, block after N in a row --
CREATE OR REPLACE FUNCTION public.report_indeed_session_error(
  p_session_id  UUID,
  p_worker_id   TEXT,
  p_message     TEXT,
  p_block_after INT DEFAULT 3
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET error_count        = COALESCE(s.error_count, 0) + 1,
         last_error_message = LEFT(p_message, 500),
         status             = CASE WHEN COALESCE(s.error_count, 0) + 1 >= p_block_after
                                   THEN 'blocked'::public.scraper_session_status
                                   ELSE s.status END,
         leased_by          = NULL,
         leased_until       = NULL,
         updated_at         = NOW()
   WHERE s.id = p_session_id
     AND s.leased_by = p_worker_id;
END;
$$;

-- 6. Release whatever this worker holds --------------------------------------
CREATE OR REPLACE FUNCTION public.release_indeed_session(p_worker_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET leased_by = NULL, leased_until = NULL, updated_at = NOW()
   WHERE s.leased_by = p_worker_id;
END;
$$;

-- 7. The extension calls these with its public key ----------------------------
GRANT EXECUTE ON FUNCTION public.claim_indeed_session(TEXT, INT, UUID)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_indeed_session(UUID, TEXT, INT)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_indeed_session_error(UUID, TEXT, TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_indeed_session(TEXT)                       TO anon, authenticated;
