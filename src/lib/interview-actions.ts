import { supabase } from '@/integrations/supabase/client';
import { HousingAnswer } from '@/lib/interview-types';

async function getActor() {
  const { data } = await supabase.auth.getUser();
  return {
    actor_id: data.user?.id ?? null,
    actor_email: data.user?.email ?? null,
  };
}

export async function updateInterviewHousing(
  applicantId: string,
  interviewId: string,
  oldValue: HousingAnswer | null,
  newValue: HousingAnswer | null
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const { error } = await (supabase as any)
    .from('interviews')
    .update({ accepts_shared_housing: newValue })
    .eq('id', interviewId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { accepts_shared_housing: { old: oldValue, new: newValue } },
    notes: 'تعديل إجابة السكن المشترك',
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}
