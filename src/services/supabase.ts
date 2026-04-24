import {createClient} from '@supabase/supabase-js';
const supabaseUrl='https://qhrennyqjhngysortocu.supabase.co';
const supabaseAnonKey='sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq';

export const supabase=createClient(supabaseUrl, supabaseAnonKey);