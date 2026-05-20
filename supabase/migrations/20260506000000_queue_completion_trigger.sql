-- Create a function that triggers when a BulkQueue item is updated
CREATE OR REPLACE FUNCTION public.check_queue_completion()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INT;
BEGIN
  -- Only care if the status is changing to 'completed' or 'failed'
  -- from an active state ('pending' or 'running')
  IF NEW.status IN ('completed', 'failed') AND OLD.status IN ('pending', 'running') THEN
    
    -- Check if there are any remaining pending or running tasks
    SELECT COUNT(*) INTO pending_count
    FROM public."BulkQueue"
    WHERE status IN ('pending', 'running');
    
    -- If count is 0, the queue just finished! Fire the webhook
    IF pending_count = 0 THEN
      -- Use pg_net to call the Edge Function securely
      PERFORM net.http_post(
        url := 'https://qyceqgttvvairnaxwicm.supabase.co/functions/v1/queue-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer recruitscout-secret-key-123'
        ),
        body := jsonb_build_object('event', 'queue_completed')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists to allow safe re-runs
DROP TRIGGER IF EXISTS on_queue_completion ON public."BulkQueue";

-- Create the trigger
CREATE TRIGGER on_queue_completion
AFTER UPDATE ON public."BulkQueue"
FOR EACH ROW
EXECUTE FUNCTION public.check_queue_completion();
