-- =====================================================================
-- Smart Link Workspace : ชุดลิงก์ (Link Collection) + ประวัติเวอร์ชันลิงก์
-- =====================================================================
-- ชุดลิงก์
--   * collections.owner_id = null  -> ชุดลิงก์ขององค์กร (ผู้ดูแลสร้าง)
--       role_ids ว่าง = ทุกคนเห็น / มีค่า = เห็นเฉพาะตำแหน่งที่เลือก
--   * collections.owner_id = <คน>  -> ชุดลิงก์ส่วนตัว เห็นและแก้ได้เฉพาะเจ้าของ
--   * ในชุดลิงก์ พนักงานจะเห็นเฉพาะลิงก์ที่ตัวเองมีสิทธิ์เปิดเท่านั้น
--     (สิทธิ์ของลิงก์ยังตรวจที่ตาราง links เหมือนเดิม)
-- ประวัติเวอร์ชัน
--   * ทุกครั้งที่ชื่อ URL หรือคำอธิบายของลิงก์เปลี่ยน ระบบเก็บค่าก่อนแก้ไว้ใน link_versions
--   * ลิงก์ขององค์กร : ผู้ดูแลดูและย้อนกลับได้ / ลิงก์ส่วนตัว : เจ้าของดูและย้อนกลับได้
--   * เก็บย้อนหลัง 50 เวอร์ชันต่อลิงก์
-- รันซ้ำได้ปลอดภัย
-- =====================================================================

-- ---------------------------------------------------------------------
-- ชุดลิงก์
-- ---------------------------------------------------------------------

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  icon        text not null default 'Folder',
  color       text not null default '#14a3a0',
  owner_id    uuid references public.profiles (id) on delete cascade,
  role_ids    uuid[] not null default '{}',
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- ชุดส่วนตัวไม่ผูกกับตำแหน่ง
  constraint collections_personal_shape check (owner_id is null or cardinality(role_ids) = 0)
);
create index if not exists collections_owner_idx on public.collections (owner_id) where owner_id is not null;

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  link_id       uuid not null references public.links (id) on delete cascade,
  sort_order    integer not null default 0,
  primary key (collection_id, link_id)
);
create index if not exists collection_items_link_idx on public.collection_items (link_id);

drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

create or replace function public.stamp_collection_creator()
returns trigger language plpgsql as $$
begin
  new.created_by := auth.uid();
  new.name := trim(new.name);
  return new;
end $$;
drop trigger if exists collections_stamp on public.collections;
create trigger collections_stamp before insert on public.collections
  for each row execute function public.stamp_collection_creator();

-- ผู้ใช้ปัจจุบันมองเห็นชุดลิงก์นี้หรือไม่
create or replace function public.can_view_collection(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from collections c
    where c.id = p_id
      and public.is_active_user()
      and (
        c.owner_id = auth.uid()
        or (c.owner_id is null and (
              public.is_admin()
              or cardinality(c.role_ids) = 0
              or exists (
                select 1 from user_roles ur join roles r on r.id = ur.role_id
                where ur.user_id = auth.uid() and r.is_active and ur.role_id = any (c.role_ids)
              )
        ))
      )
  );
$$;

-- ผู้ใช้ปัจจุบันแก้ไขชุดลิงก์นี้ได้หรือไม่
create or replace function public.can_edit_collection(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from collections c
    where c.id = p_id
      and ((c.owner_id is null and public.is_admin())
           or (c.owner_id = auth.uid() and public.is_active_user()))
  );
$$;

revoke execute on function public.can_view_collection(uuid) from anon;
revoke execute on function public.can_edit_collection(uuid) from anon;

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists collections_select on public.collections;
create policy collections_select on public.collections for select to authenticated
  using (public.can_view_collection(id));

drop policy if exists collections_admin_insert on public.collections;
create policy collections_admin_insert on public.collections for insert to authenticated
  with check (public.is_admin() and owner_id is null);
drop policy if exists collections_admin_update on public.collections;
create policy collections_admin_update on public.collections for update to authenticated
  using (public.is_admin() and owner_id is null) with check (public.is_admin() and owner_id is null);
drop policy if exists collections_admin_delete on public.collections;
create policy collections_admin_delete on public.collections for delete to authenticated
  using (public.is_admin() and owner_id is null);

drop policy if exists collections_owner_insert on public.collections;
create policy collections_owner_insert on public.collections for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user()
              and (select count(*) from public.collections c where c.owner_id = auth.uid()) < 50);
drop policy if exists collections_owner_update on public.collections;
create policy collections_owner_update on public.collections for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user()) with check (owner_id = auth.uid());
drop policy if exists collections_owner_delete on public.collections;
create policy collections_owner_delete on public.collections for delete to authenticated
  using (owner_id = auth.uid() and public.is_active_user());

drop policy if exists collection_items_select on public.collection_items;
create policy collection_items_select on public.collection_items for select to authenticated
  using (public.can_view_collection(collection_id));

-- ชุดขององค์กรใส่ได้เฉพาะลิงก์ขององค์กร / ชุดส่วนตัวใส่ได้เฉพาะลิงก์ที่เจ้าของเปิดได้
drop policy if exists collection_items_insert on public.collection_items;
create policy collection_items_insert on public.collection_items for insert to authenticated
  with check (
    public.can_edit_collection(collection_id)
    and exists (
      select 1 from collections c join links l on l.id = link_id
      where c.id = collection_id
        and ((c.owner_id is null and l.visibility <> 'personal')
             or (c.owner_id is not null and public.can_access_link(l.id)))
    )
  );
drop policy if exists collection_items_update on public.collection_items;
create policy collection_items_update on public.collection_items for update to authenticated
  using (public.can_edit_collection(collection_id)) with check (public.can_edit_collection(collection_id));
drop policy if exists collection_items_delete on public.collection_items;
create policy collection_items_delete on public.collection_items for delete to authenticated
  using (public.can_edit_collection(collection_id));

-- บันทึกรายการลิงก์ในชุดพร้อมลำดับ ในคำสั่งเดียว (security invoker : ถูกจำกัดด้วย RLS)
create or replace function public.set_collection_items(p_collection_id uuid, p_link_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_edit_collection(p_collection_id) then
    raise exception 'ไม่มีสิทธิ์แก้ไขชุดลิงก์นี้' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_link_ids), 0) > 50 then
    raise exception 'ชุดลิงก์หนึ่งชุดมีได้ไม่เกิน 50 ลิงก์' using errcode = 'P0001';
  end if;
  delete from collection_items where collection_id = p_collection_id;
  insert into collection_items (collection_id, link_id, sort_order)
  select p_collection_id, o.link_id, min(o.ord)
  from unnest(coalesce(p_link_ids, '{}')) with ordinality as o(link_id, ord)
  group by o.link_id;
end $$;
revoke execute on function public.set_collection_items(uuid, uuid[]) from anon;

-- ชุดลิงก์ขององค์กรบันทึกลงประวัติการใช้งาน (ชุดส่วนตัวไม่บันทึก)
create or replace function public.log_collection_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if v_row ->> 'owner_id' is null then
    insert into activity_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
    values (auth.uid(), lower(tg_op), 'collections', v_row ->> 'id',
            case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists collections_log on public.collections;
create trigger collections_log after insert or update or delete on public.collections
  for each row execute function public.log_collection_activity();

-- ---------------------------------------------------------------------
-- ประวัติเวอร์ชันลิงก์
-- ---------------------------------------------------------------------

create table if not exists public.link_versions (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references public.links (id) on delete cascade,
  -- ค่าของลิงก์ "ก่อน" การแก้ไขครั้งนี้
  title       text not null,
  url         text not null,
  description text,
  -- การแก้ไขครั้งนี้ทำโดยใคร เมื่อไร
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now(),
  is_restore  boolean not null default false
);
create index if not exists link_versions_link_idx on public.link_versions (link_id, changed_at desc);

alter table public.link_versions enable row level security;

-- อ่านได้ : ผู้ดูแล (ลิงก์ขององค์กร) / เจ้าของ (ลิงก์ส่วนตัว) / เขียนผ่าน trigger เท่านั้น
drop policy if exists link_versions_select on public.link_versions;
create policy link_versions_select on public.link_versions for select to authenticated
  using (exists (
    select 1 from links l
    where l.id = link_id
      and ((l.visibility <> 'personal' and public.is_admin())
           or (l.visibility = 'personal' and l.owner_id = auth.uid() and public.is_active_user()))
  ));

create or replace function public.record_link_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into link_versions (link_id, title, url, description, changed_by, is_restore)
  values (old.id, old.title, old.url, old.description, auth.uid(),
          coalesce(current_setting('smartlink.restoring', true), '') = 'on');
  -- เก็บ 50 เวอร์ชันล่าสุดต่อลิงก์
  delete from link_versions v
  where v.link_id = old.id
    and v.id not in (select id from link_versions where link_id = old.id order by changed_at desc, id desc limit 50);
  return new;
end $$;

drop trigger if exists links_version on public.links;
create trigger links_version after update on public.links
  for each row
  when (old.title is distinct from new.title
        or old.url is distinct from new.url
        or old.description is distinct from new.description)
  execute function public.record_link_version();

-- ย้อนกลับไปเวอร์ชันก่อนหน้า (security invoker : ต้องมีสิทธิ์แก้ไขลิงก์นั้นตาม RLS)
-- ค่าปัจจุบันก่อนย้อนกลับจะถูกเก็บเป็นเวอร์ชันใหม่ จึงย้อนกลับซ้ำได้อีก
create or replace function public.restore_link_version(p_version_id bigint)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v link_versions%rowtype;
  n integer;
begin
  select * into v from link_versions where id = p_version_id;
  if not found then
    raise exception 'ไม่พบเวอร์ชันนี้' using errcode = 'P0002';
  end if;
  perform set_config('smartlink.restoring', 'on', true);
  update links set title = v.title, url = v.url, description = v.description where id = v.link_id;
  get diagnostics n = row_count;
  perform set_config('smartlink.restoring', 'off', true);
  if n = 0 then
    raise exception 'ไม่มีสิทธิ์แก้ไขลิงก์นี้' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.restore_link_version(bigint) from anon;

-- ---------------------------------------------------------------------
-- Realtime : ชุดลิงก์ที่ผู้ดูแลแก้ไข อัปเดตบนหน้าจอพนักงานทันที
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'collections') then
      alter publication supabase_realtime add table public.collections;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'collection_items') then
      alter publication supabase_realtime add table public.collection_items;
    end if;
  end if;
end $$;
