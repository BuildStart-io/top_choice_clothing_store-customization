import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "top_clothes" } });

async function test() {
  const { data, error } = await supabase.rpc("get_contact_usage", { _user_id: "test", _since: "2024-01-01" });
  console.log("RPC Data:", data, "Error:", error);
}
test();
