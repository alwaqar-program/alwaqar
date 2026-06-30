-- payment_installments: additional installment payments beyond the first.
--
-- The FIRST payment continues to live on the applicants row
-- (payment_paid_amount / payment_receipt_path / payment_submitted_at /
-- payment_verified_at / payment_rejection_reason). This table holds
-- payment #2 onward for applicants who chose to pay in installments, so the
-- existing single-payment flow is untouched and this change is purely additive.

create table if not exists public.payment_installments (
  id              uuid primary key default gen_random_uuid(),
  applicant_id    uuid not null references public.applicants(id) on delete cascade,
  payment_number  integer not null,          -- 2, 3, ... (payment #1 is on the applicant row)
  amount          numeric not null,
  receipt_path    text not null,
  submitted_at    timestamptz not null default now(),
  verified_at     timestamptz,
  verified_by     text,
  rejection_reason text,
  created_at      timestamptz not null default now()
);

create index if not exists payment_installments_applicant_id_idx
  on public.payment_installments (applicant_id);

alter table public.payment_installments enable row level security;

-- Mirror the existing applicants/payment trust model: the public payment page
-- operates with the anon key (gated only by a national-id lookup), so anon may
-- read, insert, and update installment rows; authenticated staff verify them.
drop policy if exists payment_installments_select on public.payment_installments;
create policy payment_installments_select on public.payment_installments
  for select using (true);

drop policy if exists payment_installments_insert on public.payment_installments;
create policy payment_installments_insert on public.payment_installments
  for insert with check (true);

drop policy if exists payment_installments_update on public.payment_installments;
create policy payment_installments_update on public.payment_installments
  for update using (true) with check (true);
