# نظام حجز الدروس الخصوصية والدفع الإلكتروني

نظام ويب يتيح للطلاب حجز مكان في مجموعات الدروس الخصوصية والدفع أونلاين مباشرة، بدون أي تدخل بشري في التعامل مع الأموال. المدفوعات تتم مباشرة لحساب المدرّس عبر بوابة الدفع Paymob.

## التقنيات المستخدمة

- **Next.js** (App Router, TypeScript)
- **Supabase** (قاعدة بيانات PostgreSQL + Auth لصفحة الأدمن فقط)
- **Tailwind CSS**
- **Paymob API** للدفع (بطاقات بنكية + محافظ إلكترونية + فوري)
- **exceljs** لتصدير بيانات الحجوزات إلى Excel

## هيكل المشروع

```
src/
  app/
    (student)/       صفحات الحجز الخاصة بالطالب
    admin/            لوحة تحكم الأدمن
    api/               API routes (webhook الدفع، تصدير Excel)
  components/
    booking/          مكونات واجهة الحجز
    admin/             مكونات لوحة الأدمن
    ui/                 مكونات عامة
  lib/
    supabase/          عملاء Supabase (anon / admin / service-role)
    paymob/             تكامل بوابة الدفع Paymob
    validation/         مخططات التحقق (zod)
    excel/               منطق تصدير الإكسيل
  types/                 أنواع TypeScript المشتركة
supabase/
  migrations/            ملفات SQL الخاصة بقاعدة البيانات
```

---

## 1. إعداد مشروع Supabase

1. أنشئ حسابًا على [supabase.com](https://supabase.com) ثم أنشئ مشروعًا جديدًا (اختر منطقة قريبة من مصر إن أمكن).
2. من **Project Settings → API** خذ:
   - `Project URL` → هيكون `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → هيكون `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (سري جدًا) → هيكون `SUPABASE_SERVICE_ROLE_KEY`

### تشغيل ملفات الـ migration

من **SQL Editor** في لوحة تحكم Supabase، شغّل الملفات الموجودة في `supabase/migrations` **بالترتيب**:

1. `0001_init.sql` — الجداول (`grades`, `groups`, `bookings`) وسياسات RLS
2. `0002_booking_functions.sql` — دوال الحجز العامة (توفر الأماكن، إنشاء حجز، عرض حجز بالكود)
3. `0003_expiry.sql` — إلغاء الحجوزات المنتهية تلقائيًا (يحتاج `pg_cron`، وهو متاح افتراضيًا في Supabase — لو ظهر خطأ عند تفعيله يمكنك تجاهل الجزء الخاص به فقط، باقي النظام سيعمل بشكل طبيعي)

### إنشاء أول مستخدم أدمن

من **Authentication → Users** في لوحة تحكم Supabase، اضغط **Add user** وأدخل بريد إلكتروني وكلمة مرور. هذا هو حساب الدخول على `/admin`.

---

## 2. إعداد حساب Paymob

1. أنشئ حسابًا على [Paymob](https://paymob.com) (متاح وضع تجريبي/Test Mode مجانًا).
2. من **Settings → Account Info** خذ الـ **API Key** → `PAYMOB_API_KEY`.
3. من **Settings → Payment Integrations** أنشئ ثلاثة تكاملات (integrations):
   - بطاقة بنكية (Online Card) → خذ الـ Integration ID → `PAYMOB_CARD_INTEGRATION_ID`
   - محفظة إلكترونية (Mobile Wallet) → `PAYMOB_WALLET_INTEGRATION_ID`
   - فوري (Fawry) → `PAYMOB_FAWRY_INTEGRATION_ID`
4. من **Settings → Payment Integrations → iFrames** أنشئ iframe مرتبط بتكامل البطاقة البنكية → خذ الـ iFrame ID → `PAYMOB_IFRAME_ID`.
5. من **Settings → Webhooks**:
   - أضف **Transaction Processed Callback** يشير إلى: `https://<your-domain>/api/webhooks/paymob`
   - خذ الـ **HMAC Secret** الموجود في نفس الصفحة → `PAYMOB_HMAC_SECRET`
   - في كل integration (بطاقة/محفظة)، اضبط **Transaction redirection URL** (الصفحة اللي المستخدم يترجّع لها بعد الدفع) على: `https://<your-domain>/payment/result`

> أثناء التطوير المحلي استخدم أداة زي [ngrok](https://ngrok.com) عشان تدي Paymob رابط عام (public URL) يوصل لجهازك، لأن الـ webhook محتاج رابط يقدر يوصله من الإنترنت.

### اختبار الدفع في وضع Test Mode

Paymob بيوفر بطاقات اختبار جاهزة تقدر تلاقيها في **Developers → Test Cards** في لوحة التحكم بتاعتهم (رقم بطاقة + CVV + تاريخ انتهاء صلاحية وهمي). استخدمها في صفحة الدفع (iframe) بدل بيانات بطاقة حقيقية — هتظهر نفس تجربة الدفع الحقيقية لكن من غير خصم فلوس فعلي.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (سري، لا تشاركه أبدًا) |
| `PAYMOB_API_KEY` | Paymob → Settings → Account Info |
| `PAYMOB_HMAC_SECRET` | Paymob → Settings → Webhooks |
| `PAYMOB_CARD_INTEGRATION_ID` | Paymob → Settings → Payment Integrations (تكامل البطاقة) |
| `PAYMOB_WALLET_INTEGRATION_ID` | Paymob → Settings → Payment Integrations (تكامل المحفظة) |
| `PAYMOB_FAWRY_INTEGRATION_ID` | Paymob → Settings → Payment Integrations (تكامل فوري) |
| `PAYMOB_IFRAME_ID` | Paymob → Settings → Payment Integrations → iFrames |
| `NEXT_PUBLIC_SITE_URL` | رابط موقعك (`http://localhost:3000` محليًا، رابط Vercel بعد النشر) |

---

## 4. التشغيل محليًا

```bash
npm install
npm run dev
```

افتح `http://localhost:3000` لصفحة الطالب، و `http://localhost:3000/admin` للوحة تحكم الأدمن.

---

## 5. النشر على Vercel

1. ارفع المشروع على GitHub.
2. من [vercel.com](https://vercel.com) اختر **Add New → Project** واستورد الـ repository.
3. أضف كل متغيرات البيئة المذكورة أعلاه في **Settings → Environment Variables**.
4. اضغط **Deploy**.
5. بعد النشر، حدّث `NEXT_PUBLIC_SITE_URL` بالرابط الفعلي، وحدّث روابط الـ webhook والـ redirection في لوحة تحكم Paymob لتشير لنفس الرابط بدل `localhost`.
