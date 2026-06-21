import { supabase } from '@/integrations/supabase/client';

/** Minimal applicant shape used in the roommate search list. */
export interface ApplicantLite {
  id: string;
  full_name: string | null;
  national_id: string | null;
}

/**
 * Live-search active applicants by name or national ID for the roommate
 * picker. Excludes the searcher herself, plus deleted/rejected rows.
 */
export async function searchApplicants(
  query: string,
  excludeId: string
): Promise<{ data: ApplicantLite[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) return { data: [], error: null };

  const { data, error } = await (supabase as any)
    .from('applicants')
    .select('id, full_name, national_id')
    // استبعاد المحذوفة والمرفوضة والمنسحبة من قائمة البحث
    .neq('status', 'deleted')
    .neq('status', 'rejected')
    .neq('status', 'withdrew')
    .neq('id', excludeId)
    .or(`full_name.ilike.%${q}%,national_id.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(10);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ApplicantLite[], error: null };
}

export interface RoommateSlot {
  applicantId: string | null;
  otherName: string | null;
}

export interface RoommatePayload {
  wantsSpecific: boolean;
  arrangedConfirmed: boolean;
  slot1: RoommateSlot | null;
  slot2: RoommateSlot | null;
}

/**
 * Persist the applicant's roommate preferences and stamp
 * roommate_submitted_at (one-time gate, like pledgeApplicant). Writes an
 * activity-log entry attributed to the public form.
 */
export async function submitRoommatePreferences(
  applicantId: string,
  payload: RoommatePayload
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    roommate_wants_specific: payload.wantsSpecific,
    roommate_arranged_confirmed: payload.wantsSpecific ? payload.arrangedConfirmed : false,
    roommate_1_applicant_id: payload.wantsSpecific ? payload.slot1?.applicantId ?? null : null,
    roommate_1_other_name: payload.wantsSpecific ? payload.slot1?.otherName ?? null : null,
    roommate_2_applicant_id: payload.wantsSpecific ? payload.slot2?.applicantId ?? null : null,
    roommate_2_other_name: payload.wantsSpecific ? payload.slot2?.otherName ?? null : null,
    roommate_submitted_at: now,
  };

  const { error } = await (supabase as any)
    .from('applicants')
    .update(updates)
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { roommate_submitted_at: { old: null, new: now } },
    notes: payload.wantsSpecific
      ? 'تفضيلات السكن المشترك عبر النموذج العام'
      : 'تفضيلات السكن المشترك: لا ترغب بزميلات محددات (النموذج العام)',
    actor_id: null,
    actor_email: 'roommate_form@self',
  });

  return { error: null };
}
