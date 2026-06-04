// Fillout webhook receiver for new applicant form submissions.
// Public endpoint (no JWT). Insert with idempotency on submission_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Normalization helpers ----------

const NATIONALITY_MAP: Record<string, string> = {
  "سعودية": "سعودية", "سعوديه": "سعودية", "السعودية": "سعودية",
  "سعودي": "سعودية", "السعوديه": "سعودية", "saudi": "سعودية",
  "سعوديهه": "سعودية", "سعوية": "سعودية", "تشاديه": "تشادية",
  "Saudi arabia": "سعودية", "سعودية ": "سعودية",
};

const AGE_MAP: Record<string, string> = {
  "أقل من ١٦ سنة": "under_16",
  "اقل من 16 سنة": "under_16",
  "١٦ - ٣٥ سنة": "16_to_35",
  "16 - 35 سنة": "16_to_35",
  "أعلى من ٣٥ سنة": "over_35",
  "اعلى من 35 سنة": "over_35",
};

const BRANCH_MAP: Record<string, string> = {
  "٥ أجزاء": "5_juz", "5 أجزاء": "5_juz",
  "١٠ أجزاء": "10_juz", "10 أجزاء": "10_juz",
  "٢٠ جزء": "20_juz", "20 جزء": "20_juz",
  "٣٠ جزء": "30_juz", "30 جزء": "30_juz",
};

function normalizeNationality(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return NATIONALITY_MAP[s] ?? s;
}

function normalizeAge(v: unknown): string | null {
  if (!v) return null;
  return AGE_MAP[String(v).trim()] ?? null;
}

function normalizeBranch(v: unknown): string | null {
  if (!v) return null;
  return BRANCH_MAP[String(v).trim()] ?? null;
}

function toBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["نعم", "yes", "true"].includes(s)) return true;
  if (["لا", "no", "false"].includes(s)) return false;
  return null;
}

function normalizePhone(v: unknown): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("5")) return "0" + digits;
  if (digits.length === 12 && digits.startsWith("966")) return "0" + digits.slice(3);
  return digits || null;
}

function parseInt0(v: unknown): number | null {
  if (v == null || v === "") return null;
  const m = String(v).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// ---------- Label matching (flexible) ----------
// Returns the FIRST non-empty answer value whose question label contains
// any of the given Arabic substrings.
function findByLabel(questions: any[], ...needles: string[]): unknown {
  for (const n of needles) {
    for (const q of questions) {
      const name = String(q?.name ?? "").trim();
      const value = q?.value;
      if (name.includes(n) && value != null && value !== "") {
        return value;
      }
    }
  }
  return null;
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let rawPayload: any = null;

  try {
    rawPayload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  try {
    // Fillout payloads come in two common shapes depending on integration:
    //   { submissionId, submissionTime, questions: [{name,value,...}] }
    //   or wrapped in { submission: { ... } }
    const submission = rawPayload?.submission ?? rawPayload;
    const questions: any[] = submission?.questions ?? [];
    const submissionId: string | null =
      submission?.submissionId ?? submission?.id ?? null;
    const submissionTime: string | null =
      submission?.submissionTime ?? submission?.createdAt ?? null;

    if (!Array.isArray(questions) || questions.length === 0) {
      await logWebhook(supabase, "fillout", rawPayload, null, "error",
        "no questions[] array in payload", null);
      return json({ error: "no questions array" }, 400);
    }

    // Idempotency: if we already saw this submission_id, do nothing.
    if (submissionId) {
      const { data: existing } = await supabase
        .from("applicants")
        .select("id")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (existing) {
        await logWebhook(supabase, "fillout", rawPayload, null, "duplicate",
          null, existing.id);
        return json({ result: "already_imported", applicant_id: existing.id });
      }
    }

    // Map Fillout questions → applicants columns
    const fullName = findByLabel(questions, "الاسم الرباعي", "الاسم الكامل");
    const nationalId = findByLabel(questions, "رقم الهوية", "الهوية الوطنية");
    const phone = findByLabel(questions, "رقم الجوال", "الجوال");
    const guardianPhone = findByLabel(questions, "ولي الأمر", "للطوارئ");

    const dob = findByLabel(questions, "تاريخ الميلاد");

    const mapped: Record<string, unknown> = {
      submission_id: submissionId,
      full_name: fullName ? String(fullName).trim() : null,
      name_en: findByLabel(questions, "الاسم باللغة الانجليزية", "الاسم بالإنجليزية"),
      national_id: nationalId ? String(nationalId).trim() : null,
      nationality: normalizeNationality(findByLabel(questions, "الجنسية")),
      date_of_birth: dob ? String(dob).slice(0, 10) : null, // YYYY-MM-DD
      age: parseInt0(findByLabel(questions, "العمر")),
      age_category: normalizeAge(findByLabel(questions, "الفئة العمرية")),
      phone: normalizePhone(phone),
      guardian_phone: normalizePhone(guardianPhone),
      email: (() => {
        const e = findByLabel(questions, "البريد الإلكتروني");
        return e ? String(e).trim().toLowerCase() : null;
      })(),
      city: findByLabel(questions, "المدينة"),
      qualification: findByLabel(questions, "المؤهل العلمي"),
      institute_name: findByLabel(questions, "اسم الجهة (المعهد", "المعهد أو دار التحفيظ"),
      institute_is_taallam: toBool(findByLabel(questions, "تابع لجمعية المركز الخيري", "تابع لجمعية")),
      nominator: findByLabel(questions, "اسم الجهة/ الشخص الذي قام بترشيحك", "ترشيحك لدورة الوقار"),
      memorized_juz_count: parseInt0(findByLabel(questions,
        "عدد الأجزاء التي تحفظينها", "عدد الأجزاء المحفوظة")),
      from_surah: findByLabel(questions, "من سورة"),
      to_surah: findByLabel(questions, "إلى سورة"),
      desired_branch: normalizeBranch(findByLabel(questions, "الفرع المراد المشاركة")),
      curriculum_spec: findByLabel(questions, "حددي المقرر"),
      previously_joined: toBool(findByLabel(questions, "هل سبق لكِ الالتحاق بدورة الوقار",
        "سبق لك الالتحاق")),
      previous_branch: findByLabel(questions, "ما هو الفرع الذي شاركت به"),
      participation_type: findByLabel(questions, "تعتبر هذه المشاركة"),
      has_chronic_illness: toBool(findByLabel(questions, "هل تعانين من مرض مزمن", "مرض مزمن")),
      illness_type: findByLabel(questions, "نوع المرض"),
      has_companions: toBool(findByLabel(questions, "هل معكِ مرافقين", "مرافقين")),
      companions_details: findByLabel(questions, "بيانات جميع المرافقين", "بيانات المرافقات"),
      accompanying_with: findByLabel(questions, "اسم الطالبة أو المشرفة التي ترافقين"),
      notes: findByLabel(questions, "ملاحظات تودين ذكرها", "ملاحظات"),
      status: "registered",
    };

    // Decide if record is complete
    if (!mapped.full_name || !mapped.national_id || !mapped.phone) {
      mapped.status = "incomplete";
    }

    // Insert
    const { data: inserted, error: insertError } = await supabase
      .from("applicants")
      .insert(mapped)
      .select("id")
      .single();

    if (insertError) {
      await logWebhook(supabase, "fillout", rawPayload, mapped, "error",
        insertError.message, null);
      return json({ error: insertError.message }, 500);
    }

    // Activity log
    await supabase.from("applicant_activity_log").insert({
      applicant_id: inserted.id,
      action: "created",
      notes: `إدخال تلقائي من نموذج Fillout (submission ${submissionId ?? "unknown"}${submissionTime ? ", " + submissionTime : ""})`,
      actor_email: "fillout_webhook@self",
    });

    // Webhook log
    await logWebhook(supabase, "fillout", rawPayload, mapped, "inserted",
      null, inserted.id);

    return json({ result: "inserted", applicant_id: inserted.id });
  } catch (err) {
    await logWebhook(supabase, "fillout", rawPayload, null, "error",
      (err as Error).message, null);
    return json({ error: (err as Error).message }, 500);
  }
});

async function logWebhook(
  supabase: any,
  source: string,
  raw: unknown,
  mapped: unknown,
  result: string,
  error_message: string | null,
  applicant_id: string | null,
) {
  try {
    await supabase.from("webhook_logs").insert({
      source,
      raw_payload: raw,
      mapped_payload: mapped,
      result,
      error_message,
      applicant_id,
    });
  } catch (_) { /* never fail because of logging */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
