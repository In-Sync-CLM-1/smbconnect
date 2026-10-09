-- People who join an association (via invite link or email invitation) were
-- inserted into members with company_id NULL, so they never belonged to the
-- association and never appeared in its Members directory. An association's
-- direct members live in its default "<name>_Direct Members" company
-- (companies.is_default = true), so place them there.
-- Also scope the "already a member" check to that company instead of treating
-- any company-less member row as a member of every association.

CREATE OR REPLACE FUNCTION public.accept_invite_link(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_link invite_links%ROWTYPE;
  v_org_name TEXT;
  v_default_company UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be logged in to join');
  END IF;

  SELECT * INTO v_link FROM invite_links
  WHERE token = p_token AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite link not found or inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has expired');
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  IF v_link.organization_type = 'company' THEN
    IF EXISTS (
      SELECT 1 FROM members
      WHERE user_id = v_user_id AND company_id = v_link.organization_id AND is_active = true
    ) THEN
      SELECT name INTO v_org_name FROM companies WHERE id = v_link.organization_id;
      RETURN jsonb_build_object(
        'success', false, 'already_member', true,
        'organization_name', v_org_name,
        'organization_type', v_link.organization_type
      );
    END IF;

    INSERT INTO members (user_id, company_id, role, is_active)
    VALUES (v_user_id, v_link.organization_id, v_link.role, true);

    SELECT name INTO v_org_name FROM companies WHERE id = v_link.organization_id;

  ELSIF v_link.organization_type = 'association' THEN
    SELECT id INTO v_default_company
    FROM companies
    WHERE association_id = v_link.organization_id AND is_default = true
    ORDER BY created_at
    LIMIT 1;

    IF v_default_company IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'This association is not set up to accept members yet');
    END IF;

    IF v_link.role IN ('admin', 'manager') THEN
      IF EXISTS (
        SELECT 1 FROM association_managers
        WHERE user_id = v_user_id AND association_id = v_link.organization_id AND is_active = true
      ) THEN
        SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
        RETURN jsonb_build_object(
          'success', false, 'already_member', true,
          'organization_name', v_org_name,
          'organization_type', v_link.organization_type
        );
      END IF;

      INSERT INTO association_managers (user_id, association_id, role, is_active)
      VALUES (v_user_id, v_link.organization_id, v_link.role, true);

      IF NOT EXISTS (
        SELECT 1 FROM members
        WHERE user_id = v_user_id AND company_id = v_default_company AND is_active = true
      ) THEN
        INSERT INTO members (user_id, company_id, role, is_active)
        VALUES (v_user_id, v_default_company, v_link.role, true);
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM members
        WHERE user_id = v_user_id AND company_id = v_default_company AND is_active = true
      ) THEN
        SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
        RETURN jsonb_build_object(
          'success', false, 'already_member', true,
          'organization_name', v_org_name,
          'organization_type', v_link.organization_type
        );
      END IF;

      INSERT INTO members (user_id, company_id, role, is_active)
      VALUES (v_user_id, v_default_company, v_link.role, true);
    END IF;

    SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
  END IF;

  UPDATE invite_links SET use_count = use_count + 1 WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org_name,
    'organization_type', v_link.organization_type
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.complete_member_invitation_db(p_invitation_id uuid, p_user_id uuid, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation RECORD;
  v_update_count INT;
  v_default_company UUID;
BEGIN
  -- Lock and fetch invitation (prevents concurrent acceptance)
  SELECT * INTO v_invitation
  FROM member_invitations
  WHERE id = p_invitation_id AND status = 'pending'
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been used or was modified');
  END IF;

  -- Create member record
  IF v_invitation.organization_type = 'company' THEN
    INSERT INTO members (user_id, company_id, role, designation, department, is_active)
    VALUES (p_user_id, v_invitation.organization_id, v_invitation.role,
            v_invitation.designation, v_invitation.department, true);

  ELSIF v_invitation.organization_type = 'association' THEN
    SELECT id INTO v_default_company
    FROM companies
    WHERE association_id = v_invitation.organization_id AND is_default = true
    ORDER BY created_at
    LIMIT 1;

    IF v_default_company IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'This association is not set up to accept members yet');
    END IF;

    -- Create association_managers for admin/manager roles
    IF v_invitation.role IN ('admin', 'manager') THEN
      INSERT INTO association_managers (user_id, association_id, is_active)
      VALUES (p_user_id, v_invitation.organization_id, true);
    END IF;

    -- Create member record for all association invitees, inside the association
    IF NOT EXISTS (
      SELECT 1 FROM members
      WHERE user_id = p_user_id AND company_id = v_default_company AND is_active = true
    ) THEN
      INSERT INTO members (user_id, company_id, role, designation, department, is_active)
      VALUES (p_user_id, v_default_company, v_invitation.role,
              v_invitation.designation, v_invitation.department, true);
    END IF;
  END IF;

  -- Mark invitation as accepted (atomic — only if still pending)
  UPDATE member_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = p_user_id
  WHERE id = p_invitation_id AND status = 'pending';

  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  IF v_update_count = 0 THEN
    RAISE EXCEPTION 'Invitation was modified concurrently';
  END IF;

  -- Audit log
  INSERT INTO member_invitation_audit (invitation_id, action, performed_by, notes)
  VALUES (p_invitation_id, 'accepted', p_user_id, 'Registration completed successfully');

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


-- ---------------------------------------------------------------------------
-- Sign-up trigger. handle_new_user() (profile + base member record) exists but
-- nothing on auth.users calls it since the July 2026 backend cutover, so every
-- new account since then has had no profile and cannot be added as a member
-- (members.user_id references profiles). Reconnect it and repair existing
-- accounts the same way the trigger would have.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, first_name, last_name)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'first_name', ''),
       COALESCE(u.raw_user_meta_data->>'last_name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

INSERT INTO public.members (user_id, role, company_id)
SELECT u.id, 'member', NULL
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = u.id);
