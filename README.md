# نظام حجز الدروس الخصوصية والدفع الإلكتروني

نظام ويب يتيح للطلاب حجز مكان في مجموعات الدروس الخصوصية والدفع أونلاين مباشرة، بدون أي تدخل بشري في التعامل مع الأموال. المدفوعات تتم مباشرة لحساب المدرّس عبر بوابة الدفع Paymob.

## التقنيات المستخدمة

- **Next.js 14+** (App Router, TypeScript)
- **Supabase** (قاعدة بيانات PostgreSQL + Auth لصفحة الأدمن فقط)
- **Tailwind CSS**
- **Paymob API** للدفع (بطاقات بنكية + محافظ إلكترونية مثل فودافون كاش)
- **exceljs** لتصدير بيانات الحجوزات إلى Excel

> **ملاحظة:** هذا الملف هيكل أولي (skeleton) وسيتم استكماله بخطوات الإعداد التفصيلية لاحقًا (إنشاء مشروع Supabase، تشغيل الـ migrations، إعداد حساب Paymob، متغيرات البيئة، التشغيل محليًا، والنشر على Vercel).

## خطوات الإعداد (سيتم استكمالها)

1. إعداد مشروع Supabase
2. تشغيل ملفات الـ migration الموجودة في `supabase/migrations`
3. إعداد حساب Paymob (Test Mode) والحصول على المفاتيح
4. نسخ `.env.example` إلى `.env.local` وملء المتغيرات
5. تشغيل المشروع محليًا
6. النشر على Vercel

## هيكل المشروع

```
src/
  app/
    (student)/       صفحات الحجز الخاصة بالطالب
    admin/            لوحة تحكم الأدمن
    api/               API routes (webhooks، bookings، payment، export)
  components/
    booking/          مكونات واجهة الحجز
    admin/             مكونات لوحة الأدمن
    ui/                 مكونات عامة
  lib/
    supabase/          عملاء Supabase (client/server)
    paymob/             تكامل بوابة الدفع Paymob
    validation/         مخططات التحقق (zod)
    excel/               منطق تصدير الإكسيل
  types/                 أنواع TypeScript المشتركة
supabase/
  migrations/            ملفات SQL الخاصة بقاعدة البيانات
```
