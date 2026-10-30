-- =====================================================================
-- Smart Link Workspace : งานอัตโนมัติ (pg_cron)
-- =====================================================================
--   * ตรวจลิงก์ทุกเช้า 08:00 น. (เวลาไทย) ผ่าน Edge Function check-links → แจ้งผู้ดูแลเมื่อพบลิงก์เสีย
--   * สำรองข้อมูลอัตโนมัติทุกคืนวันอาทิตย์ (เก็บ 8 สัปดาห์ล่าสุดไว้ในตาราง backup_snapshots)
--
-- หลังรันไฟล์นี้ ต้องบอกที่อยู่โปรเจกต์และ anon key ให้งานตรวจลิงก์ (ทำครั้งเดียว):
--   insert into private.settings (key, value) values
--     ('project_url', 'https://<project-ref>.supabase.co'),
--     ('anon_key', '<anon key>')
--   on conflict (key) do update set value = excluded.value;
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ค่าตั้งค่าภายใน (schema private ไม่ถูกเปิดผ่าน API)
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
insert into private.settings (key, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Edge Function ใช้ตรวจว่าคำขอมาจากงานตั้งเวลาจริง (เรียกได้เฉพาะ service role)
create or replace function public.verify_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.settings where key = 'cron_secret' and value = p_secret);
$$;
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- เรียก Edge Function จากฐานข้อมูล (ใช้ใน pg_cron)
create or replace function private.call_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url    text := (select value from private.settings where key = 'project_url');
  v_key    text := (select value from private.settings where key = 'anon_key');
  v_secret text := (select value from private.settings where key = 'cron_secret');
begin
  if v_url is null or v_key is null then
    raise warning 'ยังไม่ได้ตั้งค่า project_url / anon_key ใน private.settings';
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    body := p_body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key,
      'x-cron-secret', v_secret
    ),
    timeout_milliseconds := 120000
  );
end $$;
revoke execute on function private.call_edge_function(text, jsonb) from public;

-- ---------------------------------------------------------------------
-- สำรองข้อมูล : รูปแบบเดียวกับไฟล์ที่ดาวน์โหลดจากหน้า "สำรอง/กู้คืนข้อมูล"
-- ---------------------------------------------------------------------

create table public.backup_snapshots (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('auto', 'manual')),
  data       jsonb not null,
  link_count integer not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index backup_snapshots_created_idx on public.backup_snapshots (created_at desc);

alter table public.backup_snapshots enable row level security;
create policy backup_snapshots_admin_select on public.backup_snapshots for select to authenticated using (public.is_admin());
create policy backup_snapshots_admin_delete on public.backup_snapshots for delete to authenticated using (public.is_admin());

-- งานตั้งเวลาเรียกโดยไม่มีผู้ใช้ (auth.uid() เป็น null) / ผู้ใช้ที่เรียกเองต้องเป็นผู้ดูแล
create or replace function public.create_backup_snapshot(p_kind text default 'manual')
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
  v_id   bigint;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'ต้องเป็นผู้ดูแลระบบ' using errcode = '42501';
  end if;

  v_data := jsonb_build_object(
    'format', 'smart-link-workspace-backup',
    'version', 1,
    'exported_at', now(),
    'roles', coalesce((select jsonb_agg(to_jsonb(r)) from roles r), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c)) from categories c), '[]'::jsonb),
    -- ลิงก์ส่วนตัวของพนักงานไม่ถูกสำรอง (เป็นข้อมูลส่วนบุคคล)
    'links', coalesce((select jsonb_agg(to_jsonb(l)) from links l where l.visibility <> 'personal'), '[]'::jsonb),
    'link_roles', coalesce((select jsonb_agg(to_jsonb(x)) from link_roles x), '[]'::jsonb),
    'link_user_permissions', coalesce((select jsonb_agg(to_jsonb(x)) from link_user_permissions x), '[]'::jsonb),
    'user_roles', coalesce((select jsonb_agg(to_jsonb(x)) from user_roles x), '[]'::jsonb)
  );

  insert into backup_snapshots (kind, data, link_count, created_by)
  values (
    case when p_kind = 'auto' then 'auto' else 'manual' end,
    v_data,
    jsonb_array_length(v_data -> 'links'),
    auth.uid()
  )
  returning id into v_id;

  -- เก็บอัตโนมัติ 8 ชุดล่าสุด / สำรองเอง 10 ชุดล่าสุด
  delete from backup_snapshots b
  where b.id in (
    select id from (
      select id, row_number() over (partition by kind order by created_at desc) as rn,
             case when kind = 'auto' then 8 else 10 end as keep
      from backup_snapshots
    ) t
    where t.rn > t.keep
  );
  return v_id;
end $$;
revoke execute on function public.create_backup_snapshot(text) from public, anon;

-- ---------------------------------------------------------------------
-- ตารางเวลา (เวลาเซิร์ฟเวอร์เป็น UTC : 01:00 UTC = 08:00 น. เวลาไทย)
-- ---------------------------------------------------------------------

select cron.schedule('smartlink-daily-link-check', '0 1 * * *', $$select private.call_edge_function('check-links')$$);
select cron.schedule('smartlink-weekly-backup', '0 18 * * 0', $$select public.create_backup_snapshot('auto')$$);

-- ล้างการแจ้งเตือนที่อ่านแล้วและเก่ากว่า 90 วัน (ทุกวันที่ 1 ของเดือน)
select cron.schedule(
  'smartlink-cleanup-notifications',
  '0 19 1 * *',
  $$delete from public.notifications where is_read and created_at < now() - interval '90 days'$$
);
