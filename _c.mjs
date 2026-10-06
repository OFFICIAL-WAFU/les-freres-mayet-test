import { createClient } from "@supabase/supabase-js"; import fs from "fs";
const m=JSON.parse(fs.readFileSync(process.env.HOME+"/.cache/lovable-auth/session.json"));
const sb=createClient("https://azulrjtrntkophlvdaio.supabase.co","sb_publishable_UtyB-bjbCvREWlL5wndV1A_ynXnfJ6m",{auth:{persistSession:false}});
await sb.auth.setSession({access_token:m.session.access_token,refresh_token:m.session.refresh_token});
const {data:f}=await sb.from("factures").select("id,notes,version,updated_at,total_ht_centimes,total_tva_centimes,total_ttc_centimes,ventilation_tva,reglements(*)").eq("reference_definitive","FAC-LFM-2026-00007").single();
console.log(process.argv[2], JSON.stringify(f));
