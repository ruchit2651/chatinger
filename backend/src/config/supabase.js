const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Server-side client uses the service_role key — never expose this to the browser.
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
