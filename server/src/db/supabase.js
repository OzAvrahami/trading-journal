import { createClient } from '@supabase/supabase-js';

// Lazy singleton — only instantiated on first use, so missing vars
// don't crash the server at startup if import features are unused.
let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use import features.'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false }, // server-side: no session persistence
  });

  return _client;
}
