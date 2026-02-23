// scripts/testStorageUpload.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

(async () => {
  const payload = JSON.stringify({ ok: true, ts: new Date().toISOString() });
  const { error } = await supabaseAdmin.storage
    .from("pin-cache")
    .upload("attains/states.json", Buffer.from(payload), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw error;
  console.log("Storage upload OK");
})();
