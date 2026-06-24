import { supabase } from '@/integrations/supabase/client';

export interface SupervisorRegistrationPayload {
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  hasCompanions: boolean;
  companionsDetails: string;
  notes: string;
}

/**
 * Insert a new self-registered housing supervisor (مشرفة سكن) from the
 * public registration form. Writes to the same `staff` table used by the
 * admin Staff page; RLS restricts this anonymous insert to
 * title = 'housing_supervisor' only.
 */
export async function registerSupervisor(
  payload: SupervisorRegistrationPayload
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('staff').insert({
    staff_name: payload.fullName.trim(),
    national_id: payload.nationalId.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim() || null,
    title: 'housing_supervisor',
    has_companions: payload.hasCompanions,
    companions_details: payload.hasCompanions ? payload.companionsDetails.trim() || null : null,
    notes: payload.notes.trim() || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}
