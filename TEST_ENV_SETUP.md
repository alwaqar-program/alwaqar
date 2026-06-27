# إعداد بيئة الاختبار (Test / Staging Environment)

الهدف: نسخة مطابقة من نظام الوقار للتجربة دون المساس بالإنتاج (alwaqar.org).

## المعمارية المعتمدة

| | الإنتاج (Production) | الاختبار (Staging) |
|---|---|---|
| الفرع (branch) | `main` | `staging` |
| الاستضافة (Vercel) | مشروع `alwaqar` | مشروع جديد `alwaqar-test` |
| قاعدة البيانات (Supabase) | `nahtjfnwhgmiwclyckyi` | مشروع Supabase جديد |
| الرابط | alwaqar.org | alwaqar-test.vercel.app (أو test.alwaqar.org) |

> الكود نفسه لا يتغيّر: العميل يقرأ `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` من متغيّرات البيئة، فيكفي أن نمرّر لكل بيئة قيمها الخاصة. الفرع `staging` موجود الآن على GitHub.

---

## الخطوة 1 — إنشاء مشروع Supabase للاختبار
1. من لوحة Supabase: **New project** باسم مثل `alwaqar-test` (نفس المنطقة/Region المستخدمة في الإنتاج لتسريع النسخ).
2. احفظ **كلمة مرور قاعدة البيانات** التي تظهر عند الإنشاء.
3. سجّل **Project Ref** الجديد (يظهر في الرابط: `https://<TEST_REF>.supabase.co`).

## الخطوة 2 — تثبيت الأدوات (مرة واحدة على جهازك)
الأدوات غير مثبتة حالياً. ثبّت عميل Postgres (يوفّر `pg_dump` و `psql`):
```bash
brew install postgresql@16
brew install supabase/tap/supabase   # اختياري، طريقة بديلة أسهل
```

## الخطوة 3 — نسخ بيانات الإنتاج إلى الاختبار
احصل على رابطي الاتصال (Connection string / URI) من كل مشروع:
Supabase → Project → **Settings → Database → Connection string → URI**
(استخدم الاتصال المباشر `db.<REF>.supabase.co:5432`).

```bash
# عرّف المتغيّرين (استبدل كلمات المرور والـ refs) — لا تشارك هذه في أي مكان عام
export PROD_URL="postgresql://postgres:[PROD_DB_PASSWORD]@db.nahtjfnwhgmiwclyckyi.supabase.co:5432/postgres"
export TEST_URL="postgresql://postgres:[TEST_DB_PASSWORD]@db.<TEST_REF>.supabase.co:5432/postgres"
```

نسخ كامل (المخطط + البيانات + المستخدمون) بطريقة Supabase الرسمية:
```bash
# 1) الأدوار، المخطط، البيانات
supabase db dump --db-url "$PROD_URL" -f roles.sql  --role-only
supabase db dump --db-url "$PROD_URL" -f schema.sql
supabase db dump --db-url "$PROD_URL" -f data.sql   --data-only

# 2) الاستعادة إلى مشروع الاختبار
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$TEST_URL"
```

> بديل بدون Supabase CLI (المخطط + بيانات الـ `public` فقط):
> ```bash
> pg_dump "$PROD_URL" --schema=public --no-owner --no-privileges \
>   --clean --if-exists --quote-all-identifiers -f prod_public.sql
> psql "$TEST_URL" -f prod_public.sql
> ```
> هذه الطريقة لا تنسخ `auth.users` (حسابات الدخول)؛ في هذه الحالة أنشئ مستخدم مدير جديداً في مشروع الاختبار من Supabase → **Authentication → Add user**، ثم امنحه دور admin في جدول الأدوار.

**تنبيه خصوصية:** هذا ينسخ بيانات الطالبات الحقيقية (PII) إلى مشروع ثانٍ. أبقِ مشروع الاختبار خاصاً، ولا تشارك مفاتيحه/روابطه.

## الخطوة 4 — مفاتيح مشروع الاختبار
Supabase (test) → **Settings → API**، انسخ:
- **Project URL** → `https://<TEST_REF>.supabase.co`
- **anon public key**

## الخطوة 5 — إنشاء مشروع Vercel للاختبار
1. Vercel → **Add New → Project** → اختر نفس المستودع `alwaqar-program/alwaqar`.
2. **Project Name:** `alwaqar-test`.
3. **Settings → Git → Production Branch:** غيّره إلى `staging` (مهم — حتى يبني فرع الاختبار وليس main).
4. **Settings → Environment Variables** (Production):
   - `VITE_SUPABASE_URL` = رابط مشروع الاختبار
   - `VITE_SUPABASE_ANON_KEY` = مفتاح anon لمشروع الاختبار
5. ملف `vercel.json` (إعادة التوجيه لـ SPA) موجود في المستودع، فلا حاجة لإعداد إضافي.
6. **Deploy**. الرابط سيكون `alwaqar-test.vercel.app`.

## الخطوة 6 — (اختياري) نطاق مخصص
Vercel (مشروع alwaqar-test) → **Domains** → أضف `test.alwaqar.org`، ثم أضف سجل CNAME عند مزوّد النطاق حسب تعليمات Vercel.

---

## سير العمل بعد الإعداد
- **تجربة ميزة:** `git checkout staging` → عدّل → `git push origin staging` → ينشر تلقائياً على بيئة الاختبار.
- **النقل للإنتاج بعد الاطمئنان:** ادمج staging في main:
  ```bash
  git checkout main && git pull --rebase origin main
  git merge staging && git push origin main   # ينشر على alwaqar.org
  ```
- أبقِ `staging` محدّثاً من `main` دورياً: `git checkout staging && git merge main`.

## ملاحظات
- **الـ Webhooks / Edge Functions / Storage buckets:** إن وُجدت في الإنتاج، أعد إنشاءها/إعداداتها في مشروع الاختبار يدوياً (لا تُنسخ ضمن dump قاعدة البيانات).
- **RLS:** السياسات تُنسخ ضمن المخطط، فتعمل كما في الإنتاج.
- **ملفات SQL المرقّمة** في جذر المشروع (`01_…` إلى `18_…`) تُطبَّق يدوياً في محرّر SQL إن احتجت — لكن النسخ الكامل في الخطوة 3 يغني عنها.
