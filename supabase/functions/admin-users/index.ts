// Edge Function: จัดการบัญชีพนักงาน (ต้องใช้ service role จึงทำฝั่ง client ไม่ได้)
//   POST { action: 'invite', email, full_name, job_title?, role_ids?, is_admin?, redirect_to? }
//   POST { action: 'set_active', user_id, is_active }
// ผู้เรียกต้องเป็นผู้ดูแลระบบที่ใช้งานอยู่ (ตรวจจาก JWT ของผู้เรียก)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401)

  const { data: me } = await admin
    .from('profiles')
    .select('id, is_admin, is_active')
    .eq('id', userData.user.id)
    .single()
  if (!me?.is_admin || !me.is_active) return json({ error: 'ต้องเป็นผู้ดูแลระบบ' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }

  try {
    if (body.action === 'invite') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const fullName = String(body.full_name ?? '').trim()
      const jobTitle = body.job_title ? String(body.job_title).trim() : null
      const roleIds = Array.isArray(body.role_ids) ? (body.role_ids as string[]) : []
      const isAdmin = body.is_admin === true
      if (!EMAIL_RE.test(email)) return json({ error: 'อีเมลไม่ถูกต้อง' }, 400)
      if (!fullName) return json({ error: 'กรุณากรอกชื่อพนักงาน' }, 400)

      // ส่งอีเมลเชิญ พนักงานตั้งรหัสผ่านเอง (ระบบไม่สร้างรหัสผ่านให้)
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: typeof body.redirect_to === 'string' ? body.redirect_to : undefined,
      })
      if (error) return json({ error: error.message }, 400)
      const newId = invited.user.id

      await admin
        .from('profiles')
        .upsert({ id: newId, email, full_name: fullName, job_title: jobTitle, is_admin: isAdmin, is_active: true })
      if (roleIds.length) {
        await admin
          .from('user_roles')
          .upsert(roleIds.map((role_id) => ({ user_id: newId, role_id, assigned_by: me.id })))
      }
      await admin.from('activity_logs').insert({
        actor_id: me.id,
        action: 'invite',
        entity_type: 'profiles',
        entity_id: newId,
        new_data: { email, full_name: fullName, role_ids: roleIds, is_admin: isAdmin },
      })
      return json({ id: newId })
    }

    if (body.action === 'set_active') {
      const userId = String(body.user_id ?? '')
      const isActive = body.is_active === true
      if (!userId) return json({ error: 'ไม่พบพนักงาน' }, 400)
      if (userId === me.id && !isActive) return json({ error: 'ไม่สามารถระงับบัญชีของตัวเองได้' }, 400)

      // อัปเดต profiles ก่อน (trigger กันการระงับผู้ดูแลคนสุดท้าย)
      const { error: pErr } = await admin.from('profiles').update({ is_active: isActive }).eq('id', userId)
      if (pErr) return json({ error: pErr.message }, 400)

      // ระงับที่ระดับ Auth ด้วย เพื่อให้ token เดิมใช้ต่อไม่ได้และเข้าสู่ระบบใหม่ไม่ได้
      const { error: aErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: isActive ? 'none' : '876000h',
      })
      if (aErr) return json({ error: aErr.message }, 400)
      await admin.from('activity_logs').insert({
        actor_id: me.id,
        action: isActive ? 'activate' : 'suspend',
        entity_type: 'profiles',
        entity_id: userId,
      })
      return json({ ok: true })
    }

    return json({ error: 'ไม่รู้จักคำสั่งนี้' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, 500)
  }
})
