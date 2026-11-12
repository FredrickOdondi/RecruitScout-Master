-- The dashboard chat agent stored conversation state and model credentials.
-- Those features are gone. Drop the tables and key columns if they exist.
-- Blue.cc credentials on user_integrations stay.

DROP TABLE IF EXISTS public.agent_checkpoint_writes;
DROP TABLE IF EXISTS public.agent_checkpoints;

ALTER TABLE public.user_integrations
  DROP COLUMN IF EXISTS gemini_api_key,
  DROP COLUMN IF EXISTS openai_api_key,
  DROP COLUMN IF EXISTS pinecone_api_key,
  DROP COLUMN IF EXISTS pinecone_index;
