import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WAHA_BASE = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/+$/, "");
const WAHA_KEY = Deno.env.get("WAHA_API_KEY") || "";

function detectMediaType(url: string): "image" | "video" | "audio" | "document" | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(lower)) return "image";
  if (/\.(mp4|mov|avi|webm|3gp|3gpp)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|amr|opus)(\?|$)/.test(lower)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?|csv|txt)(\?|$)/.test(lower)) return "document";
  return "image";
}

function toChatId(to: string): string {
  // Accept "+9477...", "9477...", "9477...@c.us", group "...@g.us", or a privacy "@lid" id
  if (!to) return "";
  if (to.includes("@")) return to;
  const digits = String(to).replace(/\D/g, "");
  if (!digits) return "";
  // WhatsApp privacy identifiers are 15+ digits and are NOT phone numbers —
  // sending them as @c.us silently goes nowhere.
  if (digits.length >= 15) return `${digits}@lid`;
  return `${digits}@c.us`;
}


function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "file";
    return last.split("?")[0];
  } catch {
    return "file";
  }
}

function resolveMediaUrlForWaha(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const minioEndpoint = (Deno.env.get("MINIO_ENDPOINT") || "http://minio:9000").replace(/\/+$/, "");
  const minioPublic = (Deno.env.get("MINIO_PUBLIC_URL") || "http://localhost:9000").replace(/\/+$/, "");

  let url = rawUrl;
  if (minioPublic && url.startsWith(minioPublic)) {
    url = url.replace(minioPublic, minioEndpoint);
  } else if (/^https?:\/\/localhost:9000(\/.*)?$/i.test(url)) {
    url = url.replace(/^https?:\/\/localhost:9000/i, minioEndpoint);
  } else if (/^https?:\/\/127\.0\.0\.1:9000(\/.*)?$/i.test(url)) {
    url = url.replace(/^https?:\/\/127\.0\.0\.1:9000/i, minioEndpoint);
  }
  return url;
}

async function fetchAsDataUrl(url: string, detectedType: string | null): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    const contentType = res.headers.get("content-type") || (detectedType === "image" ? "image/jpeg" : "application/octet-stream");
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    console.warn("Failed to fetch media as data URL fallback:", e);
    return null;
  }
}

async function wahaFetch(path: string, body: any) {
  if (!WAHA_BASE) throw new Error("WAHA_BASE_URL not configured");
  return fetch(`${WAHA_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": WAHA_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, message, sessionApiKey, imageUrl, mediaUrl, mediaType: explicitType } = await req.json();

    if (!to || (!message && !imageUrl && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message'/'mediaUrl' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // `sessionApiKey` is now the WAHA session name (kept variable name for back-compat with callers).
    const sessionName = sessionApiKey || Deno.env.get("WAHA_DEFAULT_SESSION") || "default";
    const chatId = toChatId(to);
    const rawUrl = mediaUrl || imageUrl;
    const detectedType = explicitType || (rawUrl ? detectMediaType(rawUrl) : null);

    console.log(`Sending WhatsApp via WAHA session=${sessionName} to=${chatId}${rawUrl ? ` (${detectedType})` : ""}: ${(message || "").substring(0, 60)}`);

    let res: Response;

    if (rawUrl) {
      const resolvedUrl = resolveMediaUrlForWaha(rawUrl);
      console.log(`Resolved media URL for WAHA: ${resolvedUrl}`);
      const fileName = filenameFromUrl(resolvedUrl);
      const file: { url: string; filename: string; mimetype?: string } = {
        url: resolvedUrl,
        filename: fileName,
      };
      const caption = message || "";

      const sendByMediaType = async (f: typeof file) => {
        switch (detectedType) {
          case "video":
            return await wahaFetch("/api/sendVideo", { session: sessionName, chatId, file: f, caption });
          case "audio":
            return await wahaFetch("/api/sendVoice", { session: sessionName, chatId, file: f });
          case "document":
            return await wahaFetch("/api/sendFile", { session: sessionName, chatId, file: f, caption });
          case "image":
          default:
            return await wahaFetch("/api/sendImage", { session: sessionName, chatId, file: f, caption });
        }
      };

      res = await sendByMediaType(file);

      // If WAHA failed to fetch the URL (e.g. 500 error connecting to URL), retry with base64 data URI
      if (!res.ok && !resolvedUrl.startsWith("data:")) {
        const errorPeek = await res.clone().text();
        if (errorPeek.includes("ECONNREFUSED") || errorPeek.includes("failed, reason") || res.status === 500) {
          console.warn(`WAHA failed with URL, attempting data URI fallback for ${resolvedUrl}`);
          const dataUrl = await fetchAsDataUrl(resolvedUrl, detectedType);
          if (dataUrl) {
            res = await sendByMediaType({ url: dataUrl, filename: fileName });
          }
        }
      }
    } else {
      res = await wahaFetch("/api/sendText", { session: sessionName, chatId, text: message });
    }

    const responseText = await res.text();
    console.log(`WAHA send response [${res.status}]: ${responseText.substring(0, 300)}`);

    if (!res.ok) {
      let parsed: any = null;
      try { parsed = JSON.parse(responseText); } catch { /* ignore */ }
      throw new Error(parsed?.message || parsed?.error || `WAHA send failed (${res.status}): ${responseText.substring(0, 200)}`);
    }

    let data: any = null;
    try { data = JSON.parse(responseText); } catch { /* ignore */ }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send WhatsApp error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
