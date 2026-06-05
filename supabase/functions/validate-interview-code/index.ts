// Validates a code typed by the committee on the public /interview page.
// The actual secret is stored in a Supabase Edge Function secret (env var)
// named INTERVIEW_CODE so it never reaches the browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("INTERVIEW_CODE");
    if (!expected || expected.length === 0) {
      return json({
        ok: false,
        error: "لم يُعَدّ رمز الدخول من قبل الإدارة بعد",
      }, 500);
    }

    let payload: { code?: unknown } = {};
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, error: "صيغة الطلب غير صحيحة" }, 400);
    }

    const entered = String(payload?.code ?? "").trim();
    if (!entered) {
      return json({ ok: false, error: "يرجى إدخال الرمز" }, 400);
    }

    // Constant-time-ish comparison
    const a = entered;
    const b = expected.trim();
    if (a.length !== b.length) return json({ ok: false });
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return json({ ok: diff === 0 });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
