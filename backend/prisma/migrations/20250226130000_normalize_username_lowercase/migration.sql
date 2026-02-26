-- Normalize existing usernames to lowercase for consistency with new validation.
-- Only update rows where username differs from lowercase version to avoid no-op updates.
UPDATE "User"
SET username = LOWER(username)
WHERE username != LOWER(username);
