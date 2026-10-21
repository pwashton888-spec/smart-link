-- Smart Link Workspace : ไฟล์ตั้งค่าฐานข้อมูลแบบรวม (คัดลอกทั้งไฟล์ไปวางใน Supabase SQL Editor แล้วกด Run ครั้งเดียว)
-- สร้างจาก supabase/migrations/* ห้ามแก้ไขไฟล์นี้โดยตรง

-- =====================================================================
-- Smart Link Workspace : โครงสร้างฐานข้อมูล + Row Level Security
-- =====================================================================
-- หลักการ
--   * สิทธิ์ทั้งหมดตรวจที่ฐานข้อมูล (RLS) ไม่ใช่แค่ซ่อนเมนูในหน้าเว็บ
--   * พนักงาน 1 คนมีได้หลายตำแหน่ง (user_roles) ลิงก์ 1 รายการเปิดให้ได้หลายตำแหน่ง (link_roles)
--   * สิทธิ์ผู้ดูแลระบบ (profiles.is_admin) แยกจากตำแหน่งงาน
--   * ลิงก์ส่วนตัวมองเห็นได้เฉพาะเจ้าของเท่านั้น (รวมถึงผู้ดูแลก็มองไม่เห็น)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ตาราง
-- ---------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text not null default '',
  job_title       text,
  avatar_url      text,
  is_active       boolean not null default true,
  is_admin        boolean not null default false,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name        text not null check (length(trim(name)) > 0),
  description text,
  color       text not null default '#0f2a5c',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9_-]{2,60}$'),
  name        text not null check (length(trim(name)) > 0),
  description text,
  icon        text not null default 'Folder',
  color       text not null default '#0f2a5c',
  role_id     uuid references public.roles (id) on delete set null,
  sort_order  integer not null default 0,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create type public.link_visibility as enum ('global', 'restricted', 'personal');

create table public.links (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 200),
  url         text not null check (url ~* '^https?://[^\s/$.?#][^\s]*$' and length(url) <= 2048),
  description text,
  usage_guide text,
  icon_url    text check (icon_url is null or icon_url ~* '^https?://'),
  category_id uuid references public.categories (id) on delete set null,
  visibility  public.link_visibility not null default 'restricted',
  owner_id    uuid references public.profiles (id) on delete cascade,
  tags        text[] not null default '{}',
  group_name  text,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- ลิงก์ส่วนตัวต้องมีเจ้าของ ลิงก์ขององค์กรต้องไม่มีเจ้าของ
  constraint links_owner_matches_visibility check (
    (visibility = 'personal' and owner_id is not null)
    or (visibility <> 'personal' and owner_id is null)
  )
);

create index links_category_idx on public.links (category_id);
create index links_owner_idx on public.links (owner_id) where owner_id is not null;
create index links_tags_idx on public.links using gin (tags);

create table public.link_roles (
  link_id uuid not null references public.links (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (link_id, role_id)
);
create index link_roles_role_idx on public.link_roles (role_id);

create table public.link_user_permissions (
  link_id    uuid not null references public.links (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (link_id, user_id)
);
create index link_user_permissions_user_idx on public.link_user_permissions (user_id);

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  link_id    uuid not null references public.links (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, link_id)
);

create table public.personal_link_preferences (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  link_id        uuid not null references public.links (id) on delete cascade,
  is_hidden      boolean not null default false,
  last_opened_at timestamptz,
  open_count     integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, link_id)
);
create index plp_recent_idx on public.personal_link_preferences (user_id, last_opened_at desc);

create table public.activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- ฟังก์ชันตรวจสิทธิ์ (security definer เพื่อหลีกเลี่ยง RLS วนซ้ำ)
-- ---------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and is_admin);
$$;

-- สิทธิ์ในฐานะ "ผู้ใช้งาน" (ไม่รวมสิทธิ์ผู้ดูแล) : รวมทุกตำแหน่งที่ได้รับ + สิทธิ์เฉพาะบุคคล + ลิงก์ส่วนกลาง
create or replace function public.can_access_link(p_link_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from links l
    where l.id = p_link_id
      and public.is_active_user()
      and (
        (l.visibility = 'personal' and l.owner_id = auth.uid())
        or (l.is_active and l.visibility = 'global')
        or (l.is_active and l.visibility = 'restricted' and (
              exists (
                select 1
                from link_roles lr
                join user_roles ur on ur.role_id = lr.role_id
                join roles r on r.id = lr.role_id
                where lr.link_id = l.id and ur.user_id = auth.uid() and r.is_active
              )
              or exists (
                select 1 from link_user_permissions lup
                where lup.link_id = l.id and lup.user_id = auth.uid()
              )
        ))
      )
  );
$$;

revoke execute on function public.is_active_user() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.can_access_link(uuid) from anon;

-- ---------------------------------------------------------------------
-- Triggers ทั่วไป
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger roles_touch before update on public.roles for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger links_touch before update on public.links for each row execute function public.touch_updated_at();
create trigger plp_touch before update on public.personal_link_preferences for each row execute function public.touch_updated_at();

-- ใส่ผู้สร้าง/ผู้แก้ไขลิงก์อัตโนมัติ (ป้องกันการปลอมค่า)
create or replace function public.stamp_link_actor()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  new.updated_by := auth.uid();
  new.url := trim(new.url);
  new.title := trim(new.title);
  return new;
end $$;
create trigger links_stamp before insert or update on public.links for each row execute function public.stamp_link_actor();

-- สร้าง profile อัตโนมัติเมื่อผู้ดูแลเชิญพนักงาน (auth.users)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ป้องกันการปิดสิทธิ์ผู้ดูแลคนสุดท้าย (กันระบบล็อกตัวเอง)
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_admin and old.is_active and (not new.is_admin or not new.is_active) then
    if not exists (select 1 from profiles where id <> old.id and is_admin and is_active) then
      raise exception 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_last_admin before update on public.profiles for each row execute function public.guard_last_admin();

-- บันทึกประวัติการเปลี่ยนแปลง (Audit log)
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity text;
begin
  -- ลิงก์ส่วนตัวเป็นข้อมูลส่วนบุคคล ไม่บันทึกลง log ที่ผู้ดูแลเห็น
  if tg_table_name = 'links' and v_row ->> 'visibility' = 'personal' then
    return coalesce(new, old);
  end if;

  v_entity := coalesce(
    v_row ->> 'id',
    concat_ws(':', v_row ->> 'link_id', v_row ->> 'user_id', v_row ->> 'role_id')
  );

  insert into activity_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name, v_entity, v_old, v_new);
  return coalesce(new, old);
end $$;

create trigger links_log after insert or update or delete on public.links for each row execute function public.log_activity();
create trigger link_roles_log after insert or delete on public.link_roles for each row execute function public.log_activity();
create trigger link_user_permissions_log after insert or delete on public.link_user_permissions for each row execute function public.log_activity();
create trigger user_roles_log after insert or delete on public.user_roles for each row execute function public.log_activity();
create trigger roles_log after insert or update or delete on public.roles for each row execute function public.log_activity();
create trigger categories_log after insert or update or delete on public.categories for each row execute function public.log_activity();
create trigger profiles_log after update on public.profiles for each row
  when (old.is_admin is distinct from new.is_admin
        or old.is_active is distinct from new.is_active
        or old.full_name is distinct from new.full_name
        or old.job_title is distinct from new.job_title)
  execute function public.log_activity();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.links enable row level security;
alter table public.link_roles enable row level security;
alter table public.link_user_permissions enable row level security;
alter table public.favorites enable row level security;
alter table public.personal_link_preferences enable row level security;
alter table public.activity_logs enable row level security;

-- profiles : เห็นของตัวเอง / ผู้ดูแลเห็นทั้งหมด / แก้ไขได้เฉพาะผู้ดูแล (ผู้ใช้แก้ชื่อตัวเองผ่าน RPC)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- roles / categories : ผู้ใช้ที่ active อ่านได้ ผู้ดูแลจัดการได้
create policy roles_select on public.roles for select to authenticated using (public.is_active_user());
create policy roles_admin_insert on public.roles for insert to authenticated with check (public.is_admin());
create policy roles_admin_update on public.roles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy roles_admin_delete on public.roles for delete to authenticated using (public.is_admin());

create policy categories_select on public.categories for select to authenticated using (public.is_active_user());
create policy categories_admin_insert on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.categories for delete to authenticated using (public.is_admin() and not is_system);

-- user_roles : เห็นตำแหน่งของตัวเอง / ผู้ดูแลจัดการได้
create policy user_roles_select on public.user_roles for select to authenticated
  using ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());
create policy user_roles_admin_insert on public.user_roles for insert to authenticated with check (public.is_admin());
create policy user_roles_admin_delete on public.user_roles for delete to authenticated using (public.is_admin());

-- links
create policy links_select on public.links for select to authenticated
  using (public.can_access_link(id) or (public.is_admin() and visibility <> 'personal'));

create policy links_admin_insert on public.links for insert to authenticated
  with check (public.is_admin() and visibility <> 'personal');
create policy links_admin_update on public.links for update to authenticated
  using (public.is_admin() and visibility <> 'personal')
  with check (public.is_admin() and visibility <> 'personal');
create policy links_admin_delete on public.links for delete to authenticated
  using (public.is_admin() and visibility <> 'personal');

create policy links_owner_insert on public.links for insert to authenticated
  with check (visibility = 'personal' and owner_id = auth.uid() and not is_featured and public.is_active_user());
create policy links_owner_update on public.links for update to authenticated
  using (visibility = 'personal' and owner_id = auth.uid() and public.is_active_user())
  with check (visibility = 'personal' and owner_id = auth.uid() and not is_featured);
create policy links_owner_delete on public.links for delete to authenticated
  using (visibility = 'personal' and owner_id = auth.uid() and public.is_active_user());

-- link_roles : อ่านได้เมื่อเข้าถึงลิงก์นั้นได้ / ผู้ดูแลจัดการ (เฉพาะลิงก์ขององค์กร)
create policy link_roles_select on public.link_roles for select to authenticated
  using (public.is_admin() or public.can_access_link(link_id));
create policy link_roles_admin_insert on public.link_roles for insert to authenticated
  with check (public.is_admin() and exists (select 1 from links l where l.id = link_id and l.visibility <> 'personal'));
create policy link_roles_admin_delete on public.link_roles for delete to authenticated using (public.is_admin());

-- link_user_permissions : เห็นเฉพาะสิทธิ์ของตัวเอง / ผู้ดูแลจัดการ
create policy lup_select on public.link_user_permissions for select to authenticated
  using ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());
create policy lup_admin_insert on public.link_user_permissions for insert to authenticated
  with check (public.is_admin() and exists (select 1 from links l where l.id = link_id and l.visibility <> 'personal'));
create policy lup_admin_delete on public.link_user_permissions for delete to authenticated using (public.is_admin());

-- favorites / preferences : ข้อมูลของตัวเองเท่านั้น และต้องเป็นลิงก์ที่มีสิทธิ์
create policy favorites_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_link(link_id));
create policy favorites_update on public.favorites for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy plp_select on public.personal_link_preferences for select to authenticated using (user_id = auth.uid());
create policy plp_insert on public.personal_link_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_link(link_id));
create policy plp_update on public.personal_link_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plp_delete on public.personal_link_preferences for delete to authenticated using (user_id = auth.uid());

-- activity_logs : อ่านได้เฉพาะผู้ดูแล / เขียนผ่าน trigger และ RPC เท่านั้น
create policy activity_logs_admin_select on public.activity_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- บันทึกการเข้าสู่ระบบ
create or replace function public.record_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update profiles set last_sign_in_at = now() where id = auth.uid();
  insert into activity_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'login', 'auth', auth.uid()::text);
end $$;

-- ผู้ใช้แก้ไขชื่อตัวเอง (ไม่สามารถแตะ is_admin / is_active ได้)
create or replace function public.update_my_profile(p_full_name text, p_job_title text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then raise exception 'บัญชีถูกระงับ'; end if;
  if length(trim(coalesce(p_full_name, ''))) = 0 then raise exception 'กรุณากรอกชื่อ'; end if;
  update profiles set full_name = trim(p_full_name), job_title = nullif(trim(p_job_title), '')
  where id = auth.uid();
end $$;

-- บันทึกการเปิดลิงก์ (สำหรับ "ใช้งานล่าสุด" และ "ใช้บ่อย")
create or replace function public.record_link_open(p_link_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_link(p_link_id) then
    raise exception 'ไม่มีสิทธิ์เข้าถึงลิงก์นี้' using errcode = '42501';
  end if;
  insert into personal_link_preferences (user_id, link_id, last_opened_at, open_count)
  values (auth.uid(), p_link_id, now(), 1)
  on conflict (user_id, link_id)
  do update set last_opened_at = now(), open_count = personal_link_preferences.open_count + 1;
end $$;

-- จัดเรียงด้วย Drag & Drop (security invoker : ถูกจำกัดด้วย RLS ของผู้เรียก)
create or replace function public.reorder_favorites(p_link_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update favorites f set sort_order = o.ord
  from unnest(p_link_ids) with ordinality as o(link_id, ord)
  where f.link_id = o.link_id and f.user_id = auth.uid();
$$;

create or replace function public.reorder_personal_links(p_link_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update links l set sort_order = o.ord
  from unnest(p_link_ids) with ordinality as o(link_id, ord)
  where l.id = o.link_id and l.owner_id = auth.uid() and l.visibility = 'personal';
$$;

create or replace function public.reorder_categories(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ต้องเป็นผู้ดูแลระบบ' using errcode = '42501'; end if;
  update categories c set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where c.id = o.id;
end $$;

create or replace function public.reorder_links(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ต้องเป็นผู้ดูแลระบบ' using errcode = '42501'; end if;
  update links l set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where l.id = o.id and l.visibility <> 'personal';
end $$;

revoke execute on function public.record_login() from anon;
revoke execute on function public.update_my_profile(text, text) from anon;
revoke execute on function public.record_link_open(uuid) from anon;
revoke execute on function public.reorder_favorites(uuid[]) from anon;
revoke execute on function public.reorder_personal_links(uuid[]) from anon;
revoke execute on function public.reorder_categories(uuid[]) from anon;
revoke execute on function public.reorder_links(uuid[]) from anon;

-- ---------------------------------------------------------------------
-- Storage : ไอคอนลิงก์ (ขนาดไม่เกิน 1MB เฉพาะไฟล์รูปภาพ)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('link-icons', 'link-icons', true, 1048576,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon'])
on conflict (id) do nothing;

-- ผู้ดูแลอัปโหลดได้ทุกที่ใน bucket / ผู้ใช้อัปโหลดได้เฉพาะโฟลเดอร์ users/<uid>/
create policy link_icons_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'link-icons'
    and (public.is_admin()
         or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text))
  );
create policy link_icons_update on storage.objects for update to authenticated
  using (
    bucket_id = 'link-icons'
    and (public.is_admin()
         or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text))
  );
create policy link_icons_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'link-icons'
    and (public.is_admin()
         or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text))
  );

-- ---------------------------------------------------------------------
-- Realtime : เมื่อผู้ดูแลเปลี่ยนสิทธิ์ หน้าเว็บของพนักงานจะโหลดข้อมูลใหม่ทันที
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.profiles, public.user_roles, public.links, public.link_roles, public.link_user_permissions;
  end if;
end $$;

-- =====================================================================
-- ข้อมูลเริ่มต้น : ตำแหน่งงาน 5 ตำแหน่ง และหมวดหมู่ 8 หมวด
-- (ไม่มีการสร้างบัญชีผู้ใช้หรือรหัสผ่านใด ๆ ในไฟล์นี้)
-- =====================================================================

insert into public.roles (code, name, description, color, sort_order) values
  ('ceo',            'CEO',              'ประธานเจ้าหน้าที่บริหาร',            '#0f2a5c', 1),
  ('secretary',      'เลขานุการ',         'งานเลขานุการและประสานงาน',           '#7c3aed', 2),
  ('finance',        'การเงิน',           'งานการเงินและบัญชี',                 '#059669', 3),
  ('marketing',      'การตลาด',           'งานการตลาดและการสื่อสาร',            '#e11d48', 4),
  ('exec_assistant', 'ผู้ช่วยผู้บริหาร',     'งานสนับสนุนผู้บริหาร',               '#0891b2', 5)
on conflict (code) do nothing;

insert into public.categories (slug, name, description, icon, color, role_id, sort_order, is_system) values
  ('global',         'เว็บไซต์ส่วนกลาง',        'ลิงก์ที่พนักงานทุกคนใช้ร่วมกัน',      'Globe',         '#0f2a5c', null, 1, true),
  ('ceo',            'เว็บไซต์ CEO',           'ลิงก์สำหรับ CEO',                    'Crown',         '#0f2a5c', (select id from public.roles where code = 'ceo'), 2, false),
  ('secretary',      'เว็บไซต์เลขานุการ',        'ลิงก์สำหรับเลขานุการ',                'CalendarClock', '#7c3aed', (select id from public.roles where code = 'secretary'), 3, false),
  ('finance',        'เว็บไซต์การเงิน',          'ลิงก์สำหรับฝ่ายการเงิน',              'Wallet',        '#059669', (select id from public.roles where code = 'finance'), 4, false),
  ('marketing',      'เว็บไซต์การตลาด',         'ลิงก์สำหรับฝ่ายการตลาด',             'Megaphone',     '#e11d48', (select id from public.roles where code = 'marketing'), 5, false),
  ('exec_assistant', 'เว็บไซต์ผู้ช่วยผู้บริหาร',    'ลิงก์สำหรับผู้ช่วยผู้บริหาร',           'Briefcase',     '#0891b2', (select id from public.roles where code = 'exec_assistant'), 6, false),
  ('personal',       'เว็บไซต์ส่วนตัว',          'ลิงก์ที่พนักงานเพิ่มเอง',              'User',          '#14a3a0', null, 7, true),
  ('frequent',       'เว็บไซต์ที่ใช้บ่อย',        'ลิงก์ที่ใช้งานเป็นประจำ',              'Flame',         '#f59e0b', null, 8, true)
on conflict (slug) do nothing;
