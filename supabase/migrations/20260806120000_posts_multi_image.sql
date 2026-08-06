-- Allow posts to carry multiple photos. image_url stays for legacy single-photo posts;
-- new posts populate image_urls (image_url is set to the first photo for back-compat readers).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_urls TEXT[];
