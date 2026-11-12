-- RecruitScout Assistant: conversation + tool audit (OpenAI agent).
-- Additive only. Does not alter scraping, queue, or Indeed lease tables.

CREATE TABLE IF NOT EXISTS public.agent_threads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'New chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_threads_user_updated_idx
  ON public.agent_threads (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID        NOT NULL REFERENCES public.agent_threads(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content     TEXT,
  tool_call_id TEXT,
  tool_name   TEXT,
  tool_calls  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_messages_thread_created_idx
  ON public.agent_messages (thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.agent_tool_runs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID        NOT NULL REFERENCES public.agent_threads(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name     TEXT        NOT NULL,
  args_summary  TEXT,
  result_summary TEXT,
  status        TEXT        NOT NULL DEFAULT 'ok'
                  CHECK (status IN ('ok', 'error', 'cancelled', 'needs_confirmation')),
  duration_ms   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_tool_runs_thread_created_idx
  ON public.agent_tool_runs (thread_id, created_at DESC);

ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own agent threads" ON public.agent_threads;
CREATE POLICY "Users manage own agent threads"
  ON public.agent_threads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own agent messages" ON public.agent_messages;
CREATE POLICY "Users manage own agent messages"
  ON public.agent_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_threads t
      WHERE t.id = agent_messages.thread_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_threads t
      WHERE t.id = agent_messages.thread_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own agent tool runs" ON public.agent_tool_runs;
CREATE POLICY "Users manage own agent tool runs"
  ON public.agent_tool_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
