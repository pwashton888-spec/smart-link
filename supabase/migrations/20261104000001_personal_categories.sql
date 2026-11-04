-- =====================================================================
-- Smart Link Workspace : หมวดหมู่ส่วนตัว (พนักงานสร้างหมวดหมู่เองได้)
-- =====================================================================
--   * categories.owner_id = null  -> หมวดหมู่ขององค์กร (ผู้ดูแลจัดการ ทุกคนเห็น)
--   * categories.owner_id = <คน>  -> หมวดหมู่ส่วนตัว เห็นและแก้ได้เฉพาะเจ้าของ
--     (ผู้ดูแลก็มองไม่เห็น เช่นเดียวกับลิงก์ส่วนตัว)
--   * ลิงก์ส่วนตัวใส่ได้ทั้งหมวดขององค์กรและหมวดส่วนตัวของตัวเอง
--     ลิงก์ขององค์กรใส่ได้เฉพาะหมวดขององค์กร
--   * ลบหมวดส่วนตัวแล้ว ลิงก์ในหมวดนั้นจะย้ายไป "เว็บไซต์ส่วนตัว" (ไม่หาย)
-- รันซ้ำได้ปลอดภัย
-- =====================================================================

alter table public.categories
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

create index if not exists categories_owner_idx on public.categories (owner_id) where owner_id is not null;

-- หมวดส่วนตัวต้องไม่ใช่หมวดระบบและไม่ผูกกับตำแหน่ง
alter table public.categories drop constraint if exists categories_personal_shape;
alter table public.categories add constraint categories_personal_shape
  check (owner_id is null or (not is_system and role_id is null));

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (public.is_active_user() and (owner_id is null or owner_id = auth.uid()));

drop policy if exists categories_admin_insert on public.categories;
create policy categories_admin_insert on public.categories for insert to authenticated
  with check (public.is_admin() and owner_id is null);
drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories for update to authenticated
  using (public.is_admin() and owner_id is null) with check (public.is_admin() and owner_id is null);
drop policy if exists categories_admin_delete on public.categories;
create policy categories_admin_delete on public.categories for delete to authenticated
  using (public.is_admin() and owner_id is null and not is_system);

drop policy if exists categories_owner_insert on public.categories;
create policy categories_owner_insert on public.categories for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user()
              and (select count(*) from public.categories c where c.owner_id = auth.uid()) < 50);
drop policy if exists categories_owner_update on public.categories;
create policy categories_owner_update on public.categories for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user()) with check (owner_id = auth.uid());
drop policy if exists categories_owner_delete on public.categories;
create policy categories_owner_delete on public.categories for delete to authenticated
  using (owner_id = auth.uid() and public.is_active_user());

-- ---------------------------------------------------------------------
-- ลิงก์ต้องอยู่ในหมวดที่ถูกต้อง
-- ---------------------------------------------------------------------

create or replace function public.check_link_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  if new.category_id is null then return new; end if;
  select owner_id into v_owner from categories where id = new.category_id;
  if v_owner is not null and (new.visibility <> 'personal' or new.owner_id is distinct from v_owner) then
    raise exception 'เลือกหมวดหมู่นี้ไม่ได้' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists links_check_category on public.links;
create trigger links_check_category before insert or update of category_id, visibility, owner_id on public.links
  for each row execute function public.check_link_category();

-- ลบหมวดส่วนตัว -> ย้ายลิงก์ไป "เว็บไซต์ส่วนตัว"
create or replace function public.move_links_from_personal_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.owner_id is not null then
    update links set category_id = (select id from categories where slug = 'personal')
    where category_id = old.id;
  end if;
  return old;
end $$;

drop trigger if exists categories_move_links on public.categories;
create trigger categories_move_links before delete on public.categories
  for each row execute function public.move_links_from_personal_category();

-- ---------------------------------------------------------------------
-- หมวดส่วนตัวเป็นข้อมูลส่วนบุคคล : ไม่บันทึกลง log และไม่สำรองข้อมูล
-- ---------------------------------------------------------------------

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity text;
begin
  -- ลิงก์ส่วนตัวและหมวดส่วนตัวเป็นข้อมูลส่วนบุคคล ไม่บันทึกลง log ที่ผู้ดูแลเห็น
  if tg_table_name = 'links' and v_row ->> 'visibility' = 'personal' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'categories' and v_row ->> 'owner_id' is not null then
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
    -- หมวดส่วนตัวและลิงก์ส่วนตัวของพนักงานไม่ถูกสำรอง (เป็นข้อมูลส่วนบุคคล)
    'categories', coalesce((select jsonb_agg(to_jsonb(c)) from categories c where c.owner_id is null), '[]'::jsonb),
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
