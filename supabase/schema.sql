-- Commlink Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Scenarios table (simulation configurations)
create table scenarios (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  environment text not null default 'default',
  waypoints jsonb not null default '[]',
  duration integer not null default 60,
  config jsonb not null default '{}',
  created_at timestamp with time zone default now()
);

-- Training runs
create table runs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'collecting', 'training', 'evaluating', 'completed', 'failed')),
  config jsonb not null default '{}',
  -- Progress tracking fields
  current_step text,                        -- 'collecting', 'training', 'evaluating'
  progress float default 0,                 -- 0.0 to 1.0
  total_steps integer default 3,            -- Number of steps (collect, train, evaluate)
  started_at timestamp with time zone,      -- When processing started
  eta_seconds integer,                      -- Estimated seconds until completion
  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Training metrics per epoch
create table metrics (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references runs(id) on delete cascade,
  epoch integer not null,
  loss float not null,
  trajectory_mse float not null,
  timestamp timestamp with time zone default now()
);

-- Model checkpoints
create table models (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references runs(id) on delete cascade,
  version integer not null,
  checkpoint_url text not null,
  eval_score float,
  created_at timestamp with time zone default now()
);

-- Data collection episodes
create table episodes (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references runs(id) on delete cascade,
  scenario_id uuid references scenarios(id) on delete set null,
  data_url text not null,
  frames integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Indexes for common queries
create index idx_runs_status on runs(status);
create index idx_runs_created_at on runs(created_at desc);
create index idx_metrics_run_id on metrics(run_id);
create index idx_metrics_epoch on metrics(run_id, epoch);
create index idx_models_run_id on models(run_id);
create index idx_episodes_run_id on episodes(run_id);

-- Updated_at trigger for runs
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger runs_updated_at
  before update on runs
  for each row
  execute function update_updated_at();

-- Enable Row Level Security (optional, for multi-user)
alter table scenarios enable row level security;
alter table runs enable row level security;
alter table metrics enable row level security;
alter table models enable row level security;
alter table episodes enable row level security;

-- Policies for public access (adjust for production)
create policy "Allow all access to scenarios" on scenarios for all using (true);
create policy "Allow all access to runs" on runs for all using (true);
create policy "Allow all access to metrics" on metrics for all using (true);
create policy "Allow all access to models" on models for all using (true);
create policy "Allow all access to episodes" on episodes for all using (true);

-- Enable realtime for live updates
alter publication supabase_realtime add table runs;
alter publication supabase_realtime add table metrics;

-- Insert a default scenario
insert into scenarios (name, environment, waypoints, duration, config)
values (
  'Basic Flight Path',
  'empty_world',
  '[{"x": 0, "y": 0, "z": 10}, {"x": 10, "y": 0, "z": 10}, {"x": 10, "y": 10, "z": 10}, {"x": 0, "y": 10, "z": 10}, {"x": 0, "y": 0, "z": 10}]',
  120,
  '{"wind_speed": 0, "obstacles": false}'
);
