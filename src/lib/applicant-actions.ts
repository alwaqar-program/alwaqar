import { supabase } from '@/integrations/supabase/client';
import { Applicant, LogAction } from './applicant-labels';

type ApplicantInput = Partial<Omit<Applicant, 'id' | 'created_at' | 'updated_at'>>;

async function getActor() {
  const { data } = await supabase.auth.getUser();
  return {
    actor_id: data.user?.id ?? null,
    actor_email: data.user?.email ?? null,
  };
}

async function writeLog(
  applicantId: string,
  action: LogAction,
  options: {
    changes?: Record<string, { old: unknown; new: unknown }> | null;
    notes?: string | null;
  } = {}
) {
  const actor = await getActor();
  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action,
    changes: options.changes ?? null,
    notes: options.notes ?? null,
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
}

export async function createApplicant(payload: ApplicantInput): Promise<{ data: Applicant | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('applicants')
    .insert({ ...payload, status: payload.status ?? 'registered' })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  await writeLog(data.id, 'created', { notes: 'إضافة متقدمة يدوياً' });
  return { data, error: null };
}

export async function updateApplicant(
  id: string,
  previous: Applicant,
  next: ApplicantInput
): Promise<{ data: Applicant | null; error: string | null }> {
  // Compute the diff
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  let statusChanged = false;
  for (const key of Object.keys(next) as (keyof ApplicantInput)[]) {
    const newVal = next[key];
    const oldVal = (previous as any)[key];
    if (newVal !== undefined && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      changes[key as string] = { old: oldVal, new: newVal };
      if (key === 'status') statusChanged = true;
    }
  }

  if (Object.keys(changes).length === 0) {
    return { data: previous, error: null };
  }

  const { data, error } = await (supabase as any)
    .from('applicants')
    .update(next)
    .eq('id', id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };

  // Two log entries when status changes: one for status_changed (highlighted), one for the other field updates
  if (statusChanged) {
    const statusDiff = { status: changes.status };
    await writeLog(id, 'status_changed', { changes: statusDiff });
  }
  const otherChanges = { ...changes };
  delete otherChanges.status;
  if (Object.keys(otherChanges).length > 0) {
    await writeLog(id, 'updated', { changes: otherChanges });
  }
  return { data, error: null };
}

export async function softDeleteApplicant(
  id: string,
  reason: string
): Promise<{ error: string | null }> {
  const { data: prev, error: readErr } = await (supabase as any)
    .from('applicants')
    .select('status')
    .eq('id', id)
    .single();
  if (readErr) return { error: readErr.message };

  const { error } = await (supabase as any)
    .from('applicants')
    .update({ status: 'deleted' })
    .eq('id', id);
  if (error) return { error: error.message };

  await writeLog(id, 'deleted', {
    changes: { status: { old: prev?.status, new: 'deleted' } },
    notes: reason,
  });
  return { error: null };
}

export async function restoreApplicant(
  id: string,
  newStatus: string = 'registered'
): Promise<{ error: string | null }> {
  const { error } = await (supabase as any)
    .from('applicants')
    .update({ status: newStatus })
    .eq('id', id);
  if (error) return { error: error.message };

  await writeLog(id, 'restored', {
    changes: { status: { old: 'deleted', new: newStatus } },
  });
  return { error: null };
}

/**
 * Public self-pledge: applicant enters her ID, sees her name,
 * agrees to the pledge text. No auth required.
 * Returns the matching applicant on success.
 */
export async function findApplicantByNationalId(
  nationalId: string
): Promise<{ data: Applicant | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('applicants')
    .select('*')
    .eq('national_id', nationalId.trim())
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as Applicant | null, error: null };
}

export async function pledgeApplicant(
  applicantId: string,
  previousStatus: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase as any)
    .from('applicants')
    .update({ status: 'pledged' })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  // Log without an auth user — actor_email marks it as self-service
  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'status_changed',
    changes: { status: { old: previousStatus, new: 'pledged' } },
    notes: 'إقرار ذاتي عبر النموذج العام',
    actor_id: null,
    actor_email: 'pledge_form@self',
  });

  return { error: null };
}
