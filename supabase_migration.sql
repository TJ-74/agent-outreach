-- ============================================================
-- Agent Outreach: Full Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enhance leads table with AI fields
-- ============================================================
alter table leads
  add column if not exists engagement_score int default 0,
  add column if not exists sentiment text default 'unknown',
  add column if not exists ai_summary text default '',
  add column if not exists next_action text default '',
  add column if not exists next_action_type text default '',
  add column if not exists next_action_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_replied_at timestamptz,
  add column if not exists tags text[] default '{}',
  add column if not exists updated_at timestamptz default now(),
  add column if not exists research text default '',
  add column if not exists action_needed text default 'none';

-- Fix leads status constraint to allow all app statuses
do $$
begin
  alter table leads drop constraint if exists leads_status_check;
exception when others then null;
end $$;
alter table leads add constraint leads_status_check
  check (status in ('new', 'contacted', 'replied', 'engaged', 'qualified', 'won', 'lost', 'nurture'));

-- 2. Messages table (local cache of Outlook emails)
-- ============================================================
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  outlook_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  subject text default '',
  body_preview text default '',
  body_html text default '',
  from_email text default '',
  from_name text default '',
  to_email text default '',
  to_name text default '',
  summary text default '',
  status text default 'read' check (status in ('read', 'unread', 'sent', 'draft', 'replied')),
  sent_at timestamptz,
  synced_at timestamptz default now()
);

create index if not exists idx_messages_lead_id on messages(lead_id);
create index if not exists idx_messages_user_id on messages(user_id);
create index if not exists idx_messages_outlook_id on messages(outlook_message_id);

alter table messages enable row level security;
create policy "Allow all access on messages" on messages for all using (true) with check (true);

-- 3. Agent runs table (AI analysis audit log)
-- ============================================================
create table if not exists agent_runs (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text default 'running' check (status in ('running', 'completed', 'failed')),
  message_count int default 0,
  summary text default '',
  sentiment text default '',
  engagement_score int default 0,
  recommended_status text default '',
  recommended_action text default '',
  recommended_action_type text default '',
  reasoning text default '',
  raw_response jsonb,
  tokens_used int default 0,
  model text default '',
  duration_ms int default 0,
  created_at timestamptz default now(),
  completed_at timestamptz,
  error text default ''
);

create index if not exists idx_agent_runs_lead_id on agent_runs(lead_id);

alter table agent_runs enable row level security;
create policy "Allow all access on agent_runs" on agent_runs for all using (true) with check (true);

-- 4. Lead events table (timeline / audit log)
-- ============================================================
create table if not exists lead_events (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null check (event_type in ('status_change', 'email_sent', 'email_received', 'agent_analysis', 'manual_update')),
  description text default '',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_lead_events_lead_id on lead_events(lead_id);

alter table lead_events enable row level security;
create policy "Allow all access on lead_events" on lead_events for all using (true) with check (true);

-- 5. Drafts table (AI-generated email drafts pending approval)
-- ============================================================
create table if not exists drafts (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  subject text default '',
  body text default '',
  reply_to_message_id text default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_drafts_lead_id on drafts(lead_id);
create index if not exists idx_drafts_user_id on drafts(user_id);

alter table drafts enable row level security;
create policy "Allow all access on drafts" on drafts for all using (true) with check (true);

-- 4. Sequences table (email cadences)
-- ============================================================
create table if not exists sequences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null default '',
  description text default '',
  status text default 'draft' check (status in ('active', 'paused', 'draft', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sequences_user_id on sequences(user_id);

alter table sequences enable row level security;
create policy "Allow all access on sequences" on sequences for all using (true) with check (true);

-- 5. Sequence steps table (individual emails in a sequence)
-- ============================================================
create table if not exists sequence_steps (
  id uuid default gen_random_uuid() primary key,
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_order int not null default 1,
  delay_days int not null default 0,
  subject_template text default '',
  body_template text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sequence_steps_sequence_id on sequence_steps(sequence_id);

alter table sequence_steps enable row level security;
create policy "Allow all access on sequence_steps" on sequence_steps for all using (true) with check (true);

-- 6. Sequence enrollments table (leads enrolled in sequences)
-- ============================================================
create table if not exists sequence_enrollments (
  id uuid default gen_random_uuid() primary key,
  sequence_id uuid not null references sequences(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  current_step int default 1,
  status text default 'active' check (status in ('active', 'completed', 'paused', 'stopped')),
  enrolled_at timestamptz default now(),
  next_step_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_sequence_enrollments_sequence_id on sequence_enrollments(sequence_id);
create index if not exists idx_sequence_enrollments_lead_id on sequence_enrollments(lead_id);

alter table sequence_enrollments enable row level security;
create policy "Allow all access on sequence_enrollments" on sequence_enrollments for all using (true) with check (true);

-- 7. Groups table (named collections of leads)
-- ============================================================
create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null default '',
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_groups_user_id on groups(user_id);

alter table groups enable row level security;
create policy "Allow all access on groups" on groups for all using (true) with check (true);

-- 8. Group members table (many-to-many: groups <-> leads)
-- ============================================================
create table if not exists group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid not null references groups(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  added_at timestamptz default now(),
  unique(group_id, lead_id)
);

create index if not exists idx_group_members_group_id on group_members(group_id);
create index if not exists idx_group_members_lead_id on group_members(lead_id);

alter table group_members enable row level security;
create policy "Allow all access on group_members" on group_members for all using (true) with check (true);

-- 9. Add group reference to sequences
-- ============================================================
alter table sequences add column if not exists group_id uuid references groups(id) on delete set null;

-- 10. Messages table: ensure summary and status columns exist (for existing DBs)
-- ============================================================
alter table messages add column if not exists summary text default '';
alter table messages add column if not exists status text default 'read';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_status_check'
  ) then
    alter table messages add constraint messages_status_check
      check (status in ('read', 'unread', 'sent', 'draft', 'replied'));
  end if;
exception
  when others then null;
end $$;

-- 11. Outlook tokens (server-side store for webhook access)
-- ============================================================
create table if not exists outlook_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table outlook_tokens enable row level security;
create policy "Allow all access on outlook_tokens" on outlook_tokens for all using (true) with check (true);

-- 12. Outlook subscriptions (Graph webhook registry)
-- ============================================================
create table if not exists outlook_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  subscription_id text not null unique,
  expiry_at timestamptz not null,
  created_at timestamptz default now()
);

alter table outlook_subscriptions enable row level security;
create policy "Allow all access on outlook_subscriptions" on outlook_subscriptions for all using (true) with check (true);

-- 13. Agent execution logs (tool-call audit trail)
-- ============================================================
create table if not exists agent_logs (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  task_type text not null default '',
  steps jsonb not null default '[]',
  duration_ms int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_agent_logs_lead_id on agent_logs(lead_id);

alter table agent_logs enable row level security;
create policy "Allow all access on agent_logs" on agent_logs for all using (true) with check (true);

-- Backfill: add columns if upgrading an existing database
alter table drafts add column if not exists reply_to_message_id text default null;
alter table messages add column if not exists from_name text default '';
alter table messages add column if not exists to_name text default '';

alter table leads add column if not exists action_needed text default 'none';
do $$ begin
  alter table leads drop constraint if exists leads_action_needed_check;
exception when others then null;
end $$;
alter table leads add constraint leads_action_needed_check
  check (action_needed in ('needs_reply', 'waiting_for_reply', 'needs_human', 'none'));

-- RPC function for agent SQL execution (guarded at the Python layer)
create or replace function exec_sql(query text)
returns json language plpgsql security definer as $$
declare
  result json;
begin
  execute query into result;
  return result;
end;
$$;

-- Sent emails (sequence step 1+ sends for approval history)
-- ============================================================
create table if not exists sent_emails (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  sequence_id uuid not null references sequences(id) on delete cascade,
  sequence_name text not null default '',
  enrollment_id uuid not null,
  lead_id uuid not null references leads(id) on delete cascade,
  lead_name text not null default '',
  lead_email text not null default '',
  company text default '',
  step_number int not null default 1,
  subject text not null default '',
  body text not null default '',
  is_html boolean default false,
  sent_at timestamptz default now()
);

create index if not exists idx_sent_emails_user_id on sent_emails(user_id);
create index if not exists idx_sent_emails_sequence_id on sent_emails(sequence_id);
create index if not exists idx_sent_emails_sent_at on sent_emails(sent_at desc);

alter table sent_emails enable row level security;
create policy "Allow all access on sent_emails" on sent_emails for all using (true) with check (true);

-- AI Training Configs (multiple per user — assigned to sequences)
-- ============================================================
create table if not exists ai_training_config (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null default '',
  description text default '',
  brand_voice text default '',
  tone text default 'professional',
  custom_instructions text default '',
  dos text[] default '{}',
  donts text[] default '{}',
  example_emails jsonb default '[]',
  sender_name text default '',
  sender_title text default '',
  company_name text default '',
  company_description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_training_config_user_id on ai_training_config(user_id);

alter table ai_training_config enable row level security;
create policy "Allow all access on ai_training_config" on ai_training_config for all using (true) with check (true);

-- Link sequences to a training config
alter table sequences add column if not exists training_config_id uuid references ai_training_config(id) on delete set null;

-- Persist generated emails on enrollments so edits / AI rewrites survive page reloads
alter table sequence_enrollments
  add column if not exists generated_subject text default '',
  add column if not exists generated_body text default '',
  add column if not exists is_html boolean default false,
  add column if not exists generated_at timestamptz;
