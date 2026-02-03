import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';
// 使用服务角色密钥以获得写权限
const supabaseKey = 'sb_service_eAgMSHqxVldtqAK3A2hRRg_zKR_4qR5';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});
