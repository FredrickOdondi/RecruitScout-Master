-- =============================================================================
-- overview_stats(): every number the dashboard Overview needs, in one call.
--
-- The Overview used to download up to 50,000 job rows through PostgREST
-- (1,000 rows per request) and count them in the browser, which took well over
-- 50 seconds. This function does the counting in Postgres and returns a few
-- kilobytes of JSON. Counts cover the whole jobs table, not a sample.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.overview_stats()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH j AS MATERIALIZED (
    SELECT
      COALESCE(NULLIF(TRIM(source), ''), 'Unknown')         AS source,
      COALESCE(NULLIF(TRIM(category), ''), 'Unknown')       AS category,
      COALESCE(NULLIF(TRIM(employmenttype), ''), 'Unknown') AS employmenttype,
      COALESCE(NULLIF(TRIM(status), ''), 'Unknown')         AS status,
      COALESCE(NULLIF(TRIM(location), ''), 'Unknown')       AS location,
      COALESCE(NULLIF(TRIM(company), ''), 'Unknown')        AS company,
      COALESCE(NULLIF(TRIM(client), ''), 'Unknown')         AS client,
      COALESCE(NULLIF(TRIM(worker_id), ''), 'Unknown')      AS worker_id,
      LEFT(extractedat, 10)                                 AS day
    FROM public.jobs
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'jobs',          (SELECT COUNT(*) FROM j),
      'clients',       (SELECT COUNT(*) FROM public.clients),
      'recruiters',    (SELECT COUNT(*) FROM public."Recruiters"),
      'queue_tasks',   (SELECT COUNT(*) FROM public."BulkQueue"),
      'email_logs',    (SELECT COUNT(*) FROM public.email_logs),
      'active_agents', (SELECT COUNT(*) FROM public."ActiveAgents")
    ),
    'per_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'source', source, 'n', n))
        FROM (SELECT day, source, COUNT(*) AS n FROM j
               WHERE day >= TO_CHAR(CURRENT_DATE - 13, 'YYYY-MM-DD')
               GROUP BY day, source) x
    ), '[]'::JSONB),
    'sources',          (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT source k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'categories',       (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT category k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x),
    'employment_types', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT employmenttype k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x),
    'job_status',       (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT status k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC) x),
    'locations',        (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT location k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x),
    'companies',        (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT company k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x),
    'workers',          (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT worker_id k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'clients',          (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT client k, COUNT(*) n FROM j GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x),
    'queue_status',     (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT COALESCE(NULLIF(TRIM(status), ''), 'Unknown') k, COUNT(*) n FROM public."BulkQueue" GROUP BY 1 ORDER BY 2 DESC) x),
    'recruiter_status', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k, 'value', n)), '[]') FROM (SELECT COALESCE(NULLIF(TRIM(status), ''), 'Unknown') k, COUNT(*) n FROM public."Recruiters" GROUP BY 1 ORDER BY 2 DESC) x),
    'generated_at', NOW()
  );
$$;

-- Signed-in dashboard users only; the function returns aggregates, never rows.
REVOKE ALL ON FUNCTION public.overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.overview_stats() TO authenticated;
