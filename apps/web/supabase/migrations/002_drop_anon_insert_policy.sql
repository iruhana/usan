-- Remove overly permissive anon INSERT policy on waitlist.
-- All inserts go through the API route using service_role,
-- so anon INSERT is unnecessary and exposes a bypass risk.
DROP POLICY IF EXISTS "Allow anonymous inserts" ON waitlist;
