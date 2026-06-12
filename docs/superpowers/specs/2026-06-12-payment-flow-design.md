# تصميم مرحلة سداد رسوم الدورة — نظام الوقار (قسم البنات)

**التاريخ:** 2026-06-12
**الحالة:** معتمد من المالكة (المسار: `/payment`، نموذج الرسوم: عمود لكل متقدمة)

## الهدف

تمكين المقبولات (`accepted`) والمقبولات بشرط (`conditionally_accepted`) من تأكيد تسجيلهن وسداد رسوم الدورة عبر رابط عام: تتحقق الطالبة بهويتها، تشاهد المبلغ المطلوب وبيانات الحساب البنكي، ترفق إيصال التحويل، ثم تراجع المشرفة الإيصال وتعتمده أو ترفضه.

## 1. صفحة الطالبة `/payment` (عامة)

صفحة جديدة `PaymentPage.tsx` على نمط `PledgePage.tsx` الحالية (شعار، عنوان، إدخال رقم الهوية بتحقق تلقائي عند 10 أرقام).

### حالات العرض (LookupState)

| الحالة | الشرط | العرض |
|---|---|---|
| `idle` / `searching` | — | حقل رقم الهوية + مؤشر تحميل |
| `not_found` | لا يوجد سجل، أو الحالة ليست `accepted`/`conditionally_accepted` | رسالة عامة: «لم نعثر على سجل مقبول بهذا الرقم» (بدون كشف تفاصيل الحالة) |
| `eligible` | مقبولة ولم تُرسل إيصالًا | نموذج السداد الكامل (أدناه) |
| `pending_review` | `payment_submitted_at` موجود و`payment_verified_at` فارغ و`payment_rejection_reason` فارغ | «تم استلام إيصالك وهو قيد المراجعة» |
| `verified` | `payment_verified_at` موجود | «تم تأكيد سدادك ✓» |
| `receipt_rejected` | `payment_rejection_reason` موجود و`payment_verified_at` فارغ | عرض سبب الرفض + نموذج إعادة رفع إيصال جديد |

### نموذج السداد (حالة eligible)

1. **بطاقة بيانات الطالبة:** الاسم، الفرع، الفئة العمرية — للتأكيد البصري
2. **بطاقة المبلغ والحساب:** المبلغ المطلوب (`payment_due_amount`)، الآيبان، اسم المستفيد، اسم البنك — مع زر نسخ للآيبان
3. **إقرار تأكيد التسجيل:** مربع اختيار «أؤكد رغبتي في إتمام التسجيل في الدورة»
4. **حقل المبلغ المحوّل:** رقمي، معبأ مسبقًا بالمبلغ المطلوب، قابل للتعديل، يجب أن يكون > 0
5. **مرفق الإيصال:** ملف واحد، أنواع `image/jpeg, image/png, application/pdf`، حد أقصى 5MB، مع معاينة اسم الملف
6. **زر إرسال:** معطّل حتى اكتمال (الإقرار + المبلغ + الملف)

### سلوك الإرسال

1. رفع الملف إلى bucket باسم `payment-receipts` بمسار `{applicant_id}/{timestamp}.{ext}`
2. تحديث سجل المتقدمة: `payment_paid_amount`، `payment_receipt_path`، `payment_submitted_at = now()`، وتصفير `payment_rejection_reason` (لدعم إعادة الرفع بعد الرفض)
3. إدراج سطر في `applicant_activity_log` بنمط الإقرار الحالي (`actor_email: 'payment_form@self'`)
4. عرض حالة النجاح «تم استلام إيصالك»

في حال فشل تحديث السجل بعد نجاح رفع الملف: تُعرض رسالة خطأ وتُتاح إعادة المحاولة (الملف اليتيم في التخزين مقبول — لا حاجة لتنظيف).

### بيانات الحساب البنكي

ثوابت في ملف واحد `src/lib/payment-config.ts`:

```ts
export const BANK_CONFIG = {
  bankName: '<يُعبّأ قبل النشر>',
  beneficiary: '<يُعبّأ قبل النشر>',
  iban: '<يُعبّأ قبل النشر>',
};
```

> **مدخل مطلوب من المالكة قبل النشر:** الآيبان، اسم المستفيد، اسم البنك.

## 2. قاعدة البيانات — `15_payment_fields.sql`

```sql
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS payment_due_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_receipt_path text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by text,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;
```

### تعبئة المبالغ بالجملة

في نفس الملف، أوامر UPDATE حسب (الفرع × الفئة العمرية) بقيم placeholder واضحة:

```sql
-- مثال — تُستبدل القيم بالمبالغ الفعلية قبل التشغيل
UPDATE public.applicants SET payment_due_amount = 000
WHERE desired_branch = '30_juz' AND age_category = '16_to_35'
  AND status IN ('accepted','conditionally_accepted')
  AND payment_due_amount IS NULL;
-- ... بقية التركيبات
```

`AND payment_due_amount IS NULL` تحمي التعديلات اليدوية للحالات الخاصة من الكتابة فوقها عند إعادة التشغيل.

> **مدخل مطلوب من المالكة قبل التشغيل:** جدول المبالغ لكل فرع/فئة عمرية.

### Storage bucket — في نفس الملف

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anon_upload_receipts" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-receipts');

CREATE POLICY "authenticated_read_receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts');
```

- الرفع متاح للزوار (الصفحة عامة)، القراءة للمشرفات المسجلات فقط عبر روابط موقعة مؤقتة (`createSignedUrl`، صلاحية 60 ثانية للمعاينة)
- لا توجد سياسة UPDATE/DELETE على الملفات — الإيصالات لا تُعدّل ولا تُحذف من الواجهة

## 3. طبقة الإجراءات — `src/lib/payment-actions.ts`

ملف جديد بجوار `applicant-actions.ts`:

- `findPayableApplicant(nationalId)` — يبحث برقم الهوية ويعيد السجل إن كانت الحالة `accepted`/`conditionally_accepted`، وإلا `null`
- `submitPayment(applicantId, paidAmount, file)` — رفع الملف ثم تحديث السجل ثم سطر السجل النشاطي (كما في §1)
- `verifyPayment(applicantId, verifierEmail)` — يضبط `payment_verified_at = now()` و`payment_verified_by`، ويسجّل في activity log
- `rejectReceipt(applicantId, reason, verifierEmail)` — يضبط `payment_rejection_reason` ويسجّل في activity log. **قرار:** `payment_submitted_at` يبقى كما هو (توثيق تاريخي)؛ تحديد حالة «مرفوض» يعتمد على وجود `payment_rejection_reason`، وإعادة الرفع تصفّره فتعود الحالة «بانتظار التحقق»

الوصول للجدول مباشر عبر anon key — نفس نمط `pledgeApplicant` الحالي وسياسة RLS الحالية المفتوحة.

## 4. جهة الإدارة

### صفحة المتقدمات `ApplicantsPage`

- **شارة حالة السداد** بجوار كل متقدمة مقبولة/مقبولة بشرط:
  - بدون شيء: لم تُرسل إيصالًا
  - 🟡 «بانتظار التحقق»: أرسلت ولم تُراجع
  - 🟢 «مسددة»: معتمدة
  - 🔴 «إيصال مرفوض»: مرفوضة بانتظار إعادة رفع
- **فلتر** جديد «حالة السداد» بنفس القيم

### صفحة ملف المتقدمة `ApplicantProfilePage`

قسم «السداد» جديد (يظهر فقط للمقبولات/المقبولات بشرط):

- المبلغ المطلوب — **قابل للتعديل** من هنا (لتخفيض الحالات الخاصة)
- المبلغ المدفوع، وقت الإرسال
- معاينة الإيصال: صورة مضمّنة أو رابط فتح PDF (عبر signed URL)
- زر **اعتماد السداد** / زر **رفض الإيصال** مع حقل سبب إلزامي
- بعد الاعتماد: تظهر بيانات الاعتماد (متى ومن)، ويُخفى زرا الإجراء

## 5. معالجة الأخطاء

- ملف أكبر من 5MB أو نوع غير مدعوم → رسالة فورية قبل الإرسال
- فشل الرفع أو التحديث → toast خطأ + إبقاء النموذج معبأ لإعادة المحاولة
- رقم هوية أقل من 10 أرقام → لا بحث (نفس سلوك الإقرار)
- اعتماد/رفض بدون إيصال مرسل → الأزرار لا تظهر أصلًا

## 6. الاختبار

- اختبار يدوي محلي (`npm run dev`) يغطي: كل حالات العرض الست، رفع صورة وPDF، تجاوز الحجم، إعادة الرفع بعد الرفض، الاعتماد والرفض من ملف المتقدمة، ظهور الشارات والفلتر
- يوجد إعداد Playwright في المشروع؛ تُضاف اختبارات e2e للصفحة العامة إن سمح الوقت (غير شرط للإطلاق)

## 7. النشر

1. تشغيل `15_payment_fields.sql` في Supabase SQL Editor (بعد تعبئة المبالغ الفعلية)
2. تعبئة `payment-config.ts` ببيانات الحساب
3. `npm run build` ثم النشر على Vercel (النمط الحالي)
4. التحقق من `alwaqar.org/payment` يعمل مباشرة (rewrites موجودة في `vercel.json`)

## خارج النطاق

- بوابة دفع إلكترونية (مدى/فيزا) — السداد تحويل بنكي يدوي فقط
- إشعارات تلقائية للطالبة (واتساب/إيميل) عند الاعتماد أو الرفض — الإرسال يدوي
- تقييد سياسة RLS المفتوحة الحالية على جدول `applicants` — قائمة قبل هذه الميزة وتحسينها مشروع مستقل
- تغيير حالة المتقدمة (`status`) عند السداد — الحالة تبقى `accepted`/`conditionally_accepted` والسداد يُتتبع بأعمدته المستقلة

## مدخلات مطلوبة من المالكة قبل الإطلاق

| المدخل | يُستخدم في |
|---|---|
| مبالغ الرسوم لكل فرع × فئة عمرية | أوامر UPDATE في `15_payment_fields.sql` |
| الآيبان + اسم المستفيد + اسم البنك | `src/lib/payment-config.ts` |
