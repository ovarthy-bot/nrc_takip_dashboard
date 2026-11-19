// Supabase Configuration and Initialization
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Bu projenin (ucaklaracekilenmalzemeler) Project Settings -> API sayfasından alındı.
const SUPABASE_URL = "https://zygnvzcknzlwssuhvgpg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tyfa1EqEkSNcFjZLmZAVQA_igjZ2XKL";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase initialized successfully');

export { supabase };
