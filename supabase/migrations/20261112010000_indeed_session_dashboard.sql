-- =============================================================================
-- Dashboard view of the Indeed scraper sessions (the Indeed accounts tab).
--
-- Depends on 20261112000000_lock_indeed_scraper_sessions.sql.
--
-- Callable by anyone signed in to the dashboard (its existing login). Shows
-- which account is in use and by which agent, which are blocked, and which
-- have expired or never had sign-in cookies. No cookie or token values are
-- returned.
-- =============================================================================

-- Safe summary of every session. No cookie, token or CSRF values leave the database.
-- login_cookie_expires_at: latest expiry among Indeed's sign-in cookies (SHOE, SOCK and the
-- PassportAuthProxy refresh token). NULL means the session has no sign-in cookies at all.
CREATE OR REPLACE FUNCTION public.list_indeed_sessions()
RETURNS TABLE (
  id                      UUID,
  account_label           TEXT,
  user_email              TEXT,
  status                  TEXT,
  leased_by               TEXT,
  leased_until            TIMESTAMPTZ,
  last_used_at            TIMESTAMPTZ,
  error_count             INT,
  last_error_message      TEXT,
  updated_at              TIMESTAMPTZ,
  cookie_count            INT,
  login_cookie_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.account_label,
    s.user_email,
    s.status::TEXT,
    s.leased_by,
    s.leased_until,
    s.last_used_at,
    s.error_count::INT,
    s.last_error_message,
    s.updated_at,
    CASE WHEN jsonb_typeof(s.cookies_payload) = 'array'
         THEN jsonb_array_length(s.cookies_payload) ELSE 0 END,
    (
      SELECT MAX(to_timestamp((c->>'expirationDate')::DOUBLE PRECISION))
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(s.cookies_payload) = 'array'
                    THEN s.cookies_payload ELSE '[]'::JSONB END) AS c
       WHERE c->>'name' IN ('SHOE', 'SOCK', '__Secure-PassportAuthProxy-RefreshToken')
         AND c ? 'expirationDate'
    )
  FROM public.indeed_scraper_sessions s
  ORDER BY s.account_label NULLS LAST, s.created_at;
END;
$$;

-- Put a blocked session back into rotation and clear its error streak.
CREATE OR REPLACE FUNCTION public.reactivate_indeed_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET status             = 'active',
         error_count        = 0,
         last_error_message = NULL,
         leased_by          = NULL,
         leased_until       = NULL,
         updated_at         = NOW()
   WHERE s.id = p_session_id;
END;
$$;

-- Free a lease an agent left behind (for example, a closed laptop).
CREATE OR REPLACE FUNCTION public.force_release_indeed_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.indeed_scraper_sessions s
     SET leased_by = NULL, leased_until = NULL, updated_at = NOW()
   WHERE s.id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_indeed_sessions()                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_indeed_session(UUID)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.force_release_indeed_session(UUID)     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_indeed_sessions()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_indeed_session(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_release_indeed_session(UUID)  TO authenticated;
