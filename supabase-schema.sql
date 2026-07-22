-- Matches table
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  uploaded_at timestamptz default now(),
  shot_count integer,
  players text[],
  metrics jsonb
);

-- Shots table (linked to matches, cascades on delete)
create table shots (
  id bigserial primary key,
  match_id uuid references matches(id) on delete cascade not null,
  point integer,
  game integer,
  set_num integer,
  shot integer,
  type text,
  player text,
  stroke text,
  result text,
  direction text,
  spin text,
  speed_mph numeric,
  hit_x numeric,
  hit_y numeric,
  hit_z numeric,
  bounce_x numeric,
  bounce_y numeric,
  bounce_zone text,
  bounce_side text,
  hit_zone text
);

-- Row-level security: users only see their own data
alter table matches enable row level security;
alter table shots enable row level security;

create policy "Users manage own matches" on matches
  for all using (auth.uid() = user_id);

create policy "Users manage own shots" on shots
  for all using (
    match_id in (select id from matches where user_id = auth.uid())
  );
