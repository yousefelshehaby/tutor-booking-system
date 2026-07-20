"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { submitFeedback } from "@/lib/feedback/actions";

type Step = "closed" | "form" | "thanks";

export function FeedbackButton({ tutorId = null }: { tutorId?: string | null }) {
  const [step, setStep] = useState<Step>("closed");
  const [messageText, setMessageText] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("closed");
    setMessageText("");
    setSenderName("");
    setSenderPhone("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!messageText.trim()) {
      setError("من فضلك اكتب رسالتك");
      return;
    }

    setSubmitting(true);
    const result = await submitFeedback({
      tutorId,
      senderName: senderName.trim() || undefined,
      senderPhone: senderPhone.trim() || undefined,
      messageText,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setStep("thanks");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("form")}
        className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
      >
        للاقتراحات والشكاوى
      </button>

      {step === "form" && (
        <Modal onClose={reset} title="اقتراحات وشكاوى">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">رسالتك</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                اسمك <span className="font-normal text-zinc-400">(اختياري — لو حابب نرد عليك)</span>
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                رقم هاتفك <span className="font-normal text-zinc-400">(اختياري — لو حابب نرد عليك)</span>
              </label>
              <input
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={reset} className="flex-1">
                إلغاء
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "جاري الإرسال..." : "إرسال"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {step === "thanks" && (
        <Modal onClose={reset} title="شكرًا لك">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-zinc-700">تم استلام رسالتك بنجاح، شكرًا لتواصلك معنا.</p>
            <Button type="button" onClick={reset}>
              إغلاق
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
