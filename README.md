# نظام حجز الدروس الخصوصية والدفع الإلكتروني

نظام ويب متعدد المدرّسين (multi-tenant) يتيح لكل مدرّس إدارة حجوزاته الخاصة، للطلاب حجز مكان في مجموعات الدروس الخصوصية والدفع أونلاين مباشرة، بدون أي تدخل بشري في التعامل مع الأموال. المدفوعات تتم مباشرة لحساب كل مدرّس عبر بوابة الدفع Paymob — الموقع نفسه لا يلمس أي فلوس.

للتوثيق الكامل والتفصيلي (كل صفحة، كل جدول، كل دالة، الأخطاء اللي اتصلحت، الإجراءات الأمنية) راجع [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).

## التقنيات المستخدمة

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Supabase** (قاعدة بيانات PostgreSQL + Row Level Security كخط الحماية الأساسي + Auth لحسابات المدرّس/المساعد/السوبر أدمن فقط — الطالب لا يسجّل دخول أبدًا)
- **Tailwind CSS v4**، واجهة عربية RTL بالكامل
- **Paymob API** للدفع (بطاقات بنكية + محافظ إلكترونية + فوري)، بيانات كل مدرّس (API key, HMAC secret, integration IDs) مخزّنة في قاعدة البيانات نفسها، مش في متغيرات البيئة
- **exceljs** لتصدير بيانات الحجوزات والمدفوعات الشهرية إلى Excel

## هيكل المشروع

راجع قسم "File Structure" في [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) لشجرة كاملة موضّحة. بإيجاز:

```
src/
  app/
    page.tsx, my-account/      دليل المدرّسين + "حسابي" (عبر كل المدرّسين)
    [tutorSlug]/                صفحات المدرّس العامة (حجز، كشف حساب، إلخ)
    admin/                      لوحة تحكم الأدمن (مدرّس/مساعد/سوبر أدمن)
    api/                        webhook الدفع + تصدير Excel
  components/                   مكوّنات الواجهة (booking, admin, monthly, my-account, ui)
  lib/                          عملاء Supabase، تكامل Paymob، rate limiting، إلخ
  types/                        أنواع TypeScript المشتركة
supabase/
  migrations/                   25 ملف SQL، تتشغّل بالترتيب
scripts/
  reset-all-data.sql            مسح كامل للبيانات (استخدام يدوي فقط، قبل التسليم الفعلي)
```

---

## 1. إعداد مشروع Supabase

1. أنشئ حسابًا على [supabase.com](https://supabase.com) ثم أنشئ مشروعًا جديدًا.
2. من **Project Settings → API** خذ:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (سري جدًا، لا تشاركه أبدًا) → `SUPABASE_SERVICE_ROLE_KEY`

### تشغيل ملفات الـ migration

لا يوجد Supabase CLI أو اتصال مباشر بقاعدة البيانات في بيئة تطوير هذا المشروع — كل الـ migrations اتشغّلت يدويًا عن طريق نسخ محتوى كل ملف ولصقه في **SQL Editor** بلوحة تحكم Supabase، **بالترتيب الرقمي** (`0001_...` لحد `0025_...`). لو بتبني قاعدة بيانات جديدة من الصفر، اتبع نفس الأسلوب.

بعض الملفات بتحتاج `pg_cron` extension (متاح افتراضيًا في Supabase) — لو ظهر خطأ عند تفعيله ممكن تتجاهل الجزء الخاص بيه بس، باقي الملف هيشتغل عادي.

### إنشاء أول حساب سوبر أدمن

1. من **Authentication → Users** أضف مستخدم جديد (بريد + باسورد).
2. من **Table Editor → admin_users** أضف صف جديد: `id` = نفس الـ user id، `role` = `super_admin`، `is_active` = `true`، `email` = نفس البريد.
3. من صفحة "المدرّسون" في اللوحة، أنشئ أول مدرّس حقيقي.

---

## 2. إعداد حساب Paymob لكل مدرّس

بيانات Paymob **مش في متغيرات البيئة** — بتتسجّل لكل مدرّس على حدة من صفحة "بروفايل المدرّس" في لوحة السوبر أدمن (`/admin/tutors/[tutorId]`، قسم "بيانات الدفع (Paymob)").

لكل مدرّس، من لوحة Paymob بتاعته:

1. **Settings → API Keys**: خذ الـ **API Key** والـ **HMAC Secret**.
2. **Settings → Payment Integrations**: أنشئ ثلاثة تكاملات (بطاقة، محفظة، فوري) وخذ الـ Integration ID بتاع كل واحد.
3. **Settings → Payment Integrations → Iframes**: أنشئ iframe مرتبط بتكامل البطاقة، وخذ الـ Iframe ID.
4. **بعد نشر الموقع** (مش قبل كده)، من نفس لوحة Paymob:
   - **Transaction Processed Callback** (الـ webhook) → `https://<الدومين بتاعك>/api/webhooks/paymob`
   - **Transaction redirection URL** (لكل تكامل بطاقة/محفظة) → `https://<الدومين بتاعك>/<slug المدرّس>/payment/result`

### الدفع في وضع Test/Sandbox

Paymob بيوفّر بطاقة اختبار رسمية (موجودة في `developers.paymob.com` تحت "Test Credentials") تشتغل من غير خصم فلوس حقيقي، حتى والحساب لسه في وضع Sandbox. **المحفظة الإلكترونية وفوري لا يعملان في وضع Sandbox حاليًا** (تم التأكد بالاختبار المباشر) — يحتاجان إما بيانات اختبار رسمية من Paymob لهاتين الطريقتين، أو إكمال توثيق الحساب عند Paymob للتحويل لوضع Live بالكامل. التفاصيل في [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) قسم 6 و9.

---

## 3. متغيرات البيئة

انسخ `.env.example` إلى `.env.local` واملأ القيم:

```bash
cp .env.example .env.local
```

| المتغير | من فين تجيبه |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (سري) |
| `NEXT_PUBLIC_SITE_URL` | رابط موقعك (`http://localhost:3000` محليًا، رابط Vercel بعد النشر) |

بيانات Paymob **ليست** متغيرات بيئة — راجع القسم السابق.

---

## 4. التشغيل محليًا

```bash
npm install
npm run dev
```

افتح `http://localhost:3000` لدليل المدرّسين، و `http://localhost:3000/admin/login` لتسجيل دخول المدرّس/المساعد/السوبر أدمن.

---

## 5. النشر على Vercel

1. ارفع المشروع على GitHub.
2. من [vercel.com](https://vercel.com) اختر **Add New → Project** واستورد الـ repository — النشر تلقائي بعد كده مع كل push على فرع `main`.
3. أضف متغيرات البيئة المذكورة أعلاه في **Settings → Environment Variables**.
4. بعد أول نشر، حدّث `NEXT_PUBLIC_SITE_URL` بالرابط الفعلي وأعد النشر (Redeploy).
5. حدّث روابط الـ webhook والـ redirection في لوحة Paymob بتاعة كل مدرّس (راجع القسم 2).

---

## إعادة ضبط كاملة (قبل تسليم حقيقي)

`scripts/reset-all-data.sql` بيمسح كل المدرّسين والحجوزات والمدفوعات والملاحظات وحسابات المساعدين، مع الاحتفاظ بحساب السوبر أدمن فقط. **استخدام يدوي ومقصود فقط** — شغّله من SQL Editor بعد التأكد إنك عايز فعلاً تمسح كل البيانات.
