// Edge Function: ตรวจสอบว่าลิงก์ขององค์กรยังเปิดได้ (ตรวจจากเซิร์ฟเวอร์ จึงเห็นรหัสตอบกลับจริง ไม่ติด CORS)
//   POST { url }          ทดสอบ URL เดียว ไม่บันทึกผล (ใช้ในฟอร์มเพิ่ม/แก้ไขลิงก์)
//   POST { link_ids? }    ตรวจลิงก์ที่เปิดใช้งานอยู่ (ไม่ส่ง = ทุกลิงก์) บันทึกผลลง link_checks
//                         และแจ้งเตือนผู้ดูแลทุกคนเมื่อพบลิงก์ที่เพิ่งเสีย
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

const TIMEOUT_MS = 10_000
const CONCURRENCY = 6

interface CheckResult {
  status: 'ok' | 'broken'
  http_status: number | null
  detail: string
}

async function checkUrl(url: string): Promise<CheckResult> {
  if (!/^https?:\/\//i.test(url)) return { status: 'broken', http_status: null, detail: 'URL ไม่ถูกต้อง' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartLinkChecker/1.0)', Accept: '*/*' },
    })
    await res.body?.cancel()
    // 401/403 = ระบบที่ต้องเข้าสู่ระบบก่อน ถือว่าลิงก์ยังใช้ได้ / 405, 429 = เซิร์ฟเวอร์ยังตอบกลับ
    if (res.ok || [401, 403, 405, 429].includes(res.status)) {
      return { status: 'ok', http_status: res.status, detail: `ตอบกลับ ${res.status}` }
    }
    const reason = res.status === 404 ? 'ไม่พบหน้าเว็บ (404)' : res.status >= 500 ? `เซิร์ฟเวอร์ขัดข้อง (${res.status})` : `ตอบกลับผิดปกติ (${res.status})`
    return { status: 'broken', http_status: res.status, detail: reason }
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return { status: 'broken', http_status: null, detail: aborted ? 'หมดเวลารอการตอบกลับ (10 วินาที)' : 'เชื่อมต่อไม่ได้ (โดเมนไม่มีอยู่ หรือเป็นเว็บภายในที่ต้องใช้ VPN)' }
  } finally {
    clearTimeout(timer)
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

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
    body = {}
  }

  try {
    if (typeof body.url === 'string') {
      return json(await checkUrl(body.url.trim()))
    }

    let query = admin.from('links').select('id, title, url').neq('visibility', 'personal').eq('is_active', true)
    if (Array.isArray(body.link_ids)) query = query.in('id', body.link_ids as string[])
    const { data: links, error: lErr } = await query
    if (lErr) return json({ error: lErr.message }, 400)
    if (!links.length) return json({ checked: 0, broken: [] })

    const { data: previous } = await admin.from('link_checks').select('link_id, status').in('link_id', links.map((l) => l.id))
    const wasBroken = new Set((previous ?? []).filter((p) => p.status === 'broken').map((p) => p.link_id))

    const results = await mapLimit(links, CONCURRENCY, (l) => checkUrl(l.url))
    const now = new Date().toISOString()
    const { error: cErr } = await admin.from('link_checks').upsert(
      links.map((l, i) => ({ link_id: l.id, ...results[i], checked_at: now, checked_by: me.id })),
    )
    if (cErr) return json({ error: cErr.message }, 400)

    const broken = links
      .filter((_, i) => results[i].status === 'broken')
      .map((l) => ({ id: l.id, title: l.title, url: l.url, detail: results[links.indexOf(l)].detail }))

    // แจ้งเตือนเฉพาะลิงก์ที่เพิ่งเสีย (เสียต่อเนื่องจากรอบก่อนไม่แจ้งซ้ำ)
    const newlyBroken = broken.filter((l) => !wasBroken.has(l.id))
    if (newlyBroken.length) {
      const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true).eq('is_active', true)
      const rows = (admins ?? []).flatMap((a) =>
        newlyBroken.map((l) => ({
          user_id: a.id,
          kind: 'link_broken',
          title: `ลิงก์เสีย: ${l.title}`,
          body: `${l.detail} · ${l.url}`,
          link_id: l.id,
        })),
      )
      if (rows.length) await admin.from('notifications').insert(rows)
    }

    return json({ checked: links.length, broken })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, 500)
  }
})
