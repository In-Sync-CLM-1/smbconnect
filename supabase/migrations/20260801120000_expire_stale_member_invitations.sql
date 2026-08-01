-- Pending invitations never actually expired: expires_at passing did not change
-- `status`, so the partial unique index idx_member_invitations_pending_unique on
-- (lower(email), organization_id) WHERE status = 'pending' permanently blocked any
-- future re-invite of that email to that org once the original 48h window lapsed.
-- This RPC flips stale ones to 'expired' so they drop out of that uniqueness scope.
-- Called every 30 min by cron-worker/jobs.txt (smbconnect-cron-expire-member-invitations).
CREATE OR REPLACE FUNCTION public.expire_stale_member_invitations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.member_invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('expired_count', v_count);
END;
$function$;
