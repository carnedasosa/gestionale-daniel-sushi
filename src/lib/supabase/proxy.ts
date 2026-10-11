import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ruoloRichiesto } from '@/auth/regole'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value))
      },
    },
  })

  // Niente codice tra createServerClient e getClaims (indicazione della documentazione Supabase).
  const { data } = await supabase.auth.getClaims()

  // Qui solo «sei loggato?»: il ruolo lo verificano layout e azioni server (richiediRuolo).
  if (!data?.claims && ruoloRichiesto(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/accesso'
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
