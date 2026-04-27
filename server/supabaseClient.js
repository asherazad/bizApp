const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Supabase client disabled');
  module.exports = null;
} else {
  module.exports = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}
