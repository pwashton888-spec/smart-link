-- =====================================================================
-- Smart Link Workspace : การแจ้งเตือน + ผลตรวจสอบลิงก์
-- =====================================================================
--   * แจ้งเตือนพนักงานทุกคนเมื่อมีลิงก์ส่วนกลางใหม่ (หรือลิงก์ถูกเปลี่ยนเป็นส่วนกลาง / เปิดใช้งาน)
--   * แจ้งเตือนผู้ดูแลระบบเมื่อตรวจสอบแล้วพบลิงก์เสีย (Edge Function check-links เป็นผู้บันทึก)
-- =====================================================================

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('new_link', 'link_broken')),
  title      text not null,
  body       text,
  link_id    uuid references public.links (id) on delete cascade,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ผลตรวจสอบล่าสุดของแต่ละลิงก์ (แยกจากตาราง links เพื่อไม่ให้รก audit log)
create table public.link_checks (
  link_id     uuid primary key references public.links (id) on delete cascade,
  status      text not null check (status in ('ok', 'broken')),
  http_status integer,
  detail      text,
  checked_at  timestamptz not null default now(),
  checked_by  uuid references public.profiles (id) on delete set null
);

alter table public.notifications enable row level security;
alter table public.link_checks enable row level security;

-- เห็นและลบได้เฉพาะการแจ้งเตือนของตัวเอง (สร้างผ่าน trigger / Edge Function เท่านั้น)
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy link_checks_admin_select on public.link_checks for select to authenticated
  using (public.is_admin());

-- ทำเครื่องหมายว่าอ่านแล้ว (ไม่ส่ง id = อ่านทั้งหมด)
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql security definer set search_path = public as $$
  update notifications set is_read = true
  where user_id = auth.uid() and not is_read and (p_ids is null or id = any (p_ids));
$$;
revoke execute on function public.mark_notifications_read(bigint[]) from anon;

-- ลิงก์ส่วนกลางใหม่ → แจ้งพนักงานที่ใช้งานอยู่ทุกคน (ยกเว้นผู้สร้าง)
create or replace function public.notify_new_global_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility <> 'global' or not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
       (old.visibility = 'global' and old.is_active)
       -- ปิดแล้วเปิดใหม่ ไม่ต้องแจ้งซ้ำ
       or exists (select 1 from notifications where link_id = new.id and kind = 'new_link')
     ) then
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, link_id)
  select p.id, 'new_link', 'ลิงก์ส่วนกลางใหม่: ' || new.title, new.description, new.id
  from profiles p
  where p.is_active and p.id is distinct from auth.uid();
  return new;
end $$;

create trigger links_notify_global after insert or update on public.links
  for each row execute function public.notify_new_global_link();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
