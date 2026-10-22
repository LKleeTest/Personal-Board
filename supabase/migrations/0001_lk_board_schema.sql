-- LK Board tables (prefixed lk_ so they never touch existing tables such as public.profiles).
-- Already applied to project kbvbfxbrmztyzuyvahgs; kept here for reference.
create table public.lk_profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '', lang text not null default 'en-SG',
  xp integer not null default 0, streak integer not null default 0, best integer not null default 0,
  last_done date, mail_to text not null default '',
  end_hour integer not null default 18 check (end_hour between 0 and 23),
  updated_at timestamptz not null default now()
);
create table public.lk_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, icon text not null default '📝', position integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.lk_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid references public.lk_lists(id) on delete set null,
  title text not null, due date, priority boolean not null default false,
  done boolean not null default false, done_at date, xp integer not null default 0,
  sample boolean not null default false, auto uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.lk_task_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.lk_tasks(id) on delete cascade,
  text text not null, done boolean not null default false, done_on date, position integer not null default 0
);
create table public.lk_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, amount numeric(14,2), currency text not null default 'SGD', due date not null,
  repeat text not null default 'once' check (repeat in ('once','weekly','monthly','quarterly','yearly')),
  anchor_day integer check (anchor_day between 1 and 31), note text not null default '',
  autopay boolean not null default false, paid boolean not null default false,
  sample boolean not null default false, created_at timestamptz not null default now()
);
create table public.lk_bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id uuid not null references public.lk_bills(id) on delete cascade,
  paid_on date not null, amount numeric(14,2), currency text not null default 'SGD', on_time boolean not null default true
);
create table public.lk_drafts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null, subject text not null default '', body text not null default '',
  edited boolean not null default false, saved_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index lk_lists_user_idx on public.lk_lists(user_id);
create index lk_tasks_user_idx on public.lk_tasks(user_id);
create index lk_tasks_list_idx on public.lk_tasks(list_id);
create index lk_tasks_due_idx on public.lk_tasks(user_id, due);
create index lk_steps_user_idx on public.lk_task_steps(user_id);
create index lk_steps_task_idx on public.lk_task_steps(task_id);
create index lk_bills_user_due_idx on public.lk_bills(user_id, due);
create index lk_payments_user_idx on public.lk_bill_payments(user_id);
create index lk_payments_bill_idx on public.lk_bill_payments(bill_id);
-- row level security: every table is limited to the signed-in owner's rows
alter table public.lk_profile enable row level security;
alter table public.lk_lists enable row level security;
alter table public.lk_tasks enable row level security;
alter table public.lk_task_steps enable row level security;
alter table public.lk_bills enable row level security;
alter table public.lk_bill_payments enable row level security;
alter table public.lk_drafts enable row level security;
create policy "own rows" on public.lk_profile for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_lists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_task_steps for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_bills for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_bill_payments for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.lk_drafts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- live data
alter publication supabase_realtime add table public.lk_profile, public.lk_lists, public.lk_tasks, public.lk_task_steps, public.lk_bills, public.lk_bill_payments, public.lk_drafts;
