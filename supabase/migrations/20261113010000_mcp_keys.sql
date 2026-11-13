-- =============================================================================
-- MCP access: per-user keys, an audit log, and a command relay to extensions.
--
-- * mcp_keys: a signed-in user creates keys with create_mcp_key(); only the
--   sha256 hash is stored, the plain key is returned once.
-- * mcp_tool_runs: every MCP tool call, written by the mcp edge function.
-- * mcp_bridge_commands: browser-only work (engine, local jobs, Gmail) that the
--   mcp function hands to a RecruitScout extension. Extensions claim and finish
--   commands only through the two RPCs below; the table itself has no anon access.
-- Additive only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mcp_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'MCP key',
  key_prefix   TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS mcp_keys_user_idx ON public.mcp_keys (user_id, created_at DESC);

ALTER TABLE public.mcp_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own mcp keys" ON public.mcp_keys;
CREATE POLICY "Users see own mcp keys" ON public.mcp_keys FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_mcp_key(p_name TEXT DEFAULT 'MCP key')
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user UUID := auth.uid();
  v_key  TEXT;
  v_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to create an MCP key.' USING ERRCODE = '42501';
  END IF;
  v_key := 'rs_' || encode(gen_random_bytes(20), 'hex');
  INSERT INTO public.mcp_keys (user_id, name, key_prefix, key_hash)
  VALUES (v_user, COALESCE(NULLIF(TRIM(p_name), ''), 'MCP key'), LEFT(v_key, 11),
          encode(sha256(convert_to(v_key, 'UTF8')), 'hex'))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'key', v_key);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_mcp_key(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    UPDATE public.mcp_keys SET revoked_at = NOW()
    WHERE id = p_id AND user_id = auth.uid() AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM r);
$$;

REVOKE ALL ON FUNCTION public.create_mcp_key(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_mcp_key(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mcp_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_mcp_key(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.mcp_tool_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id       UUID        REFERENCES public.mcp_keys(id) ON DELETE SET NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name    TEXT        NOT NULL,
  args_summary TEXT,
  ok           BOOLEAN     NOT NULL,
  error        TEXT,
  duration_ms  INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mcp_tool_runs_user_idx ON public.mcp_tool_runs (user_id, created_at DESC);
ALTER TABLE public.mcp_tool_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own mcp tool runs" ON public.mcp_tool_runs;
CREATE POLICY "Users see own mcp tool runs" ON public.mcp_tool_runs FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mcp_bridge_commands (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent       TEXT,
  message     JSONB       NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'claimed', 'done', 'failed')),
  result      JSONB,
  claimed_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at  TIMESTAMPTZ,
  done_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS mcp_bridge_pending_idx ON public.mcp_bridge_commands (status, created_at)
  WHERE status = 'pending';
ALTER TABLE public.mcp_bridge_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own bridge commands" ON public.mcp_bridge_commands;
CREATE POLICY "Users see own bridge commands" ON public.mcp_bridge_commands FOR SELECT USING (auth.uid() = user_id);

-- An extension claims the oldest pending command addressed to it (or to any
-- agent). SKIP LOCKED means two browsers never get the same command.
-- Commands older than 10 minutes are left alone: whoever asked has stopped waiting.
CREATE OR REPLACE FUNCTION public.claim_bridge_command(p_agent TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.mcp_bridge_commands;
BEGIN
  IF p_agent IS NULL OR TRIM(p_agent) = '' THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.mcp_bridge_commands
  WHERE status = 'pending'
    AND created_at > NOW() - INTERVAL '10 minutes'
    AND (agent IS NULL OR agent = p_agent)
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.mcp_bridge_commands
     SET status = 'claimed', claimed_by = p_agent, claimed_at = NOW()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('id', v_row.id, 'message', v_row.message);
END $$;

CREATE OR REPLACE FUNCTION public.complete_bridge_command(p_id UUID, p_agent TEXT, p_ok BOOLEAN, p_result JSONB)
RETURNS BOOLEAN
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    UPDATE public.mcp_bridge_commands
       SET status = CASE WHEN p_ok THEN 'done' ELSE 'failed' END, result = p_result, done_at = NOW()
     WHERE id = p_id AND status = 'claimed' AND claimed_by = p_agent
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM r);
$$;

GRANT EXECUTE ON FUNCTION public.claim_bridge_command(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_bridge_command(UUID, TEXT, BOOLEAN, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
