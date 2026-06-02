-- Give companies a cover banner, matching associations (one level lower).
-- Associations already have cover_image; companies only had logo.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cover_image text;

COMMENT ON COLUMN public.companies.cover_image IS 'Public URL of the company cover/banner image (stored in the profile-images bucket).';
