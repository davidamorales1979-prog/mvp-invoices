-- Allow authenticated users to read their own pending invite by email
-- This is needed so loadProfile can auto-accept a pending invite
-- when a user arrives at the app without the ?join=TOKEN in the URL
drop policy if exists "User views own invite by email" on team_members;
create policy "User views own invite by email" on team_members
  for select using (auth.jwt() ->> 'email' = email);

-- Also allow team members to read the account subscription
-- so the subscription check works correctly for members
drop policy if exists "Team member reads account subscription" on subscriptions;
create policy "Team member reads account subscription" on subscriptions
  for select using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );
