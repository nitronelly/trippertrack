import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jimbbuwuafyfuvaszdcx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0h5pEJ34h946jtcmRwG9CA_pt1uKzZo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});