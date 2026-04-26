import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // אמת משתמש
    const { data: userData, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (userData.user.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const action = body.action ?? 'create_user'

    // ── פעולה: רשימת משתמשים ──────────────────────────
    if (action === 'list_users') {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers()
      if (error) throw error

      // טען ישירות מ-auth.users — ללא תלות ב-profiles
      const result = users.map(u => ({
        id:           u.id,
        email:        u.email,
        created_at:   u.created_at,
        last_sign_in: u.last_sign_in_at,
        plan:         u.app_metadata?.plan ?? 'free',
        plan_until:   u.app_metadata?.plan_until ?? null,
        role:         u.app_metadata?.role ?? null,
      }))

      return new Response(JSON.stringify({ success: true, users: result }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── פעולה: יצירת משתמש ────────────────────────────
    if (action === 'create_user') {
      const { email, password, plan, plan_until } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'email and password required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          plan: plan ?? 'free',
          ...(plan === 'premium' && plan_until ? { plan_until } : {}),
        },
      })

      if (createError) throw createError

      // שמור ב-profiles
      await adminClient.from('profiles').upsert({
        email,
        plan:       plan ?? 'free',
        plan_until: plan === 'premium' ? (plan_until ?? null) : null,
      }, { onConflict: 'email' })

      return new Response(JSON.stringify({
        success: true,
        user_id: newUser.user?.id,
        email:   newUser.user?.email,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── פעולה: עדכון פרימיום ──────────────────────────
    if (action === 'set_premium') {
      const { email, enable, plan_until } = body
      if (!email) {
        return new Response(JSON.stringify({ error: 'email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // עדכן app_metadata
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const target = users.find(u => u.email === email)
      if (target) {
        await adminClient.auth.admin.updateUserById(target.id, {
          app_metadata: {
            ...target.app_metadata,
            plan: enable ? 'premium' : 'free',
            ...(enable && plan_until ? { plan_until } : {}),
          }
        })
      }

      // עדכן profiles
      await adminClient.from('profiles').upsert({
        email,
        plan:       enable ? 'premium' : 'free',
        plan_until: enable ? (plan_until ?? null) : null,
      }, { onConflict: 'email' })

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── פעולה: עדכון סיסמה ──────────────────────────
    if (action === 'set_password') {
      const { email, password } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'email and password required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (password.length < 8) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const target = users.find(u => u.email === email)
      if (!target) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { error: pwError } = await adminClient.auth.admin.updateUserById(target.id, { password })
      if (pwError) throw pwError

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
