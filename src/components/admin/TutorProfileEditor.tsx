"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  updateTutorProfile,
  updateTutorEmail,
  generateTutorPassword,
  uploadTutorPhoto,
} from "@/app/admin/(protected)/tutors/actions";

export interface TutorProfile {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  is_active: boolean;
  photo_url: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
}

export function TutorProfileEditor({
  tutor,
  adminEmail,
}: {
  tutor: TutorProfile;
  adminEmail: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <ProfileForm tutor={tutor} onSaved={() => router.refresh()} />
      <PhotoSection tutorId={tutor.id} photoUrl={tutor.photo_url} onUploaded={() => router.refresh()} />
      <EmailSection tutorId={tutor.id} currentEmail={adminEmail} onSaved={() => router.refresh()} />
      <PasswordSection tutorId={tutor.id} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 font-semibold text-zinc-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";

function ProfileForm({ tutor, onSaved }: { tutor: TutorProfile; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: tutor.name,
    slug: tutor.slug,
    phone: tutor.phone ?? "",
    bankName: tutor.bank_name ?? "",
    bankAccountHolder: tutor.bank_account_holder ?? "",
    bankAccountNumber: tutor.bank_account_number ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const result = await updateTutorProfile(tutor.id, form);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    onSaved();
  }

  return (
    <Section title="البيانات الأساسية">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اسم المدرّس">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="الرابط (بالإنجليزي)">
          <input
            required
            dir="ltr"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="رقم الهاتف">
          <input
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2 mt-2 border-t border-zinc-100 pt-4">
          <p className="mb-3 text-sm font-medium text-zinc-700">
            بيانات الحساب البنكي (لسجلات مدير النظام فقط — لا تظهر للطلاب)
          </p>
        </div>

        <Field label="اسم البنك">
          <input
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="اسم صاحب الحساب">
          <input
            value={form.bankAccountHolder}
            onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="رقم الحساب">
          <input
            dir="ltr"
            value={form.bankAccountNumber}
            onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "جاري الحفظ..." : "حفظ"}
          </Button>
          {success && <span className="text-sm text-green-700">تم الحفظ ✓</span>}
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      </form>
    </Section>
  );
}

function PhotoSection({
  tutorId,
  photoUrl,
  onUploaded,
}: {
  tutorId: string;
  photoUrl: string | null;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.set("photo", file);
    const result = await uploadTutorPhoto(tutorId, formData);

    setUploading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setPreview(result.photoUrl);
    onUploaded();
  }

  return (
    <Section title="الصورة الشخصية">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-zinc-100">
          {preview ? (
            <Image src={preview} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
              لا صورة
            </div>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm"
          />
          {uploading && <p className="mt-1 text-sm text-zinc-500">جاري الرفع...</p>}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </Section>
  );
}

function EmailSection({
  tutorId,
  currentEmail,
  onSaved,
}: {
  tutorId: string;
  currentEmail: string | null;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const result = await updateTutorEmail(tutorId, email);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    onSaved();
  }

  return (
    <Section title="البريد الإلكتروني لتسجيل الدخول">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Field label="البريد الإلكتروني">
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "جاري الحفظ..." : "حفظ"}
        </Button>
        {success && <span className="text-sm text-green-700">تم الحفظ ✓</span>}
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Section>
  );
}

function PasswordSection({ tutorId }: { tutorId: string }) {
  const [generating, setGenerating] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGeneratedPassword(null);
    setCopied(false);

    const result = await generateTutorPassword(tutorId);

    setGenerating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setGeneratedPassword(result.password);
  }

  async function handleCopy() {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
  }

  return (
    <Section title="كلمة المرور">
      <p className="mb-3 text-sm text-zinc-600">
        كلمات المرور مشفّرة ولا يمكن عرضها بعد إنشائها. توليد كلمة مرور جديدة سيُظهرها مرة واحدة فقط
        هنا — انسخها وابعتها للمدرّس فورًا، لأنها لن تظهر مرة أخرى.
      </p>

      {generatedPassword ? (
        <div className="flex flex-col gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
          <p className="text-sm font-semibold text-yellow-800">كلمة المرور الجديدة (مرة واحدة فقط):</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono">
              {generatedPassword}
            </code>
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copied ? "تم النسخ ✓" : "نسخ"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setGeneratedPassword(null)}
            className="self-start text-xs text-zinc-500 hover:underline"
          >
            إخفاء
          </button>
        </div>
      ) : (
        <Button type="button" disabled={generating} onClick={handleGenerate}>
          {generating ? "جاري التوليد..." : "توليد كلمة مرور جديدة"}
        </Button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Section>
  );
}
