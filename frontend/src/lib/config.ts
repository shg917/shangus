// Values compiled into the client must be public. Leave both blank for local demo.
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '',
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '',
  redirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || '',
}
