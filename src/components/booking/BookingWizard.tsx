"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressIndicator } from "@/components/booking/ProgressIndicator";
import { Step1PersonalInfo } from "@/components/booking/Step1PersonalInfo";
import { Step2Grade } from "@/components/booking/Step2Grade";
import { Step3Group } from "@/components/booking/Step3Group";
import { Step4Payment } from "@/components/booking/Step4Payment";
import { submitBooking } from "@/app/(student)/book/actions";
import { Button } from "@/components/ui/Button";
import type { BookingFormData, PaymentMethod, PersonalInfo } from "@/types/booking";

const TOTAL_STEPS = 4;

function MissingStepsNotice({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center" dir="rtl">
      <p className="text-zinc-600">
        يبدو أنك حاولت الوصول لهذه الخطوة مباشرة. من فضلك أكمل الخطوات السابقة أولًا.
      </p>
      <Button type="button" onClick={onRestart}>
        الرجوع لبداية الحجز
      </Button>
    </div>
  );
}

function readStepFromUrl(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOTAL_STEPS) return 1;
  return parsed;
}

export function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = readStepFromUrl(searchParams.get("step"));

  const [formData, setFormData] = useState<BookingFormData>({
    studentName: "",
    studentPhone: "",
    guardianPhone: "",
    gradeId: null,
    groupId: null,
    paymentMethod: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function goToStep(next: number) {
    router.push(`/book?step=${next}`, { scroll: false });
  }

  function handlePersonalInfoNext(value: PersonalInfo) {
    setFormData((prev) => ({ ...prev, ...value }));
    goToStep(2);
  }

  function handleGradeNext(gradeId: string) {
    setFormData((prev) => ({ ...prev, gradeId, groupId: null }));
    goToStep(3);
  }

  function handleGroupNext(groupId: string) {
    setFormData((prev) => ({ ...prev, groupId }));
    goToStep(4);
  }

  async function handlePaymentSubmit(paymentMethod: PaymentMethod) {
    setSubmitError(null);
    setSubmitting(true);

    const result = await submitBooking({ ...formData, paymentMethod });

    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error);
      return;
    }

    setFormData((prev) => ({ ...prev, paymentMethod }));

    if (result.nextAction === "redirect") {
      window.location.href = result.paymentUrl;
    } else if (result.nextAction === "fawry_reference") {
      router.push(
        `/payment/fawry?code=${encodeURIComponent(result.bookingCode)}&ref=${encodeURIComponent(result.billReference)}`
      );
    } else {
      router.push(`/booking/${result.bookingCode}`);
    }
  }

  return (
    <div className="w-full max-w-lg" dir="rtl">
      <ProgressIndicator currentStep={step} />

      {step === 1 && (
        <Step1PersonalInfo
          value={{
            studentName: formData.studentName,
            studentPhone: formData.studentPhone,
            guardianPhone: formData.guardianPhone,
          }}
          onNext={handlePersonalInfoNext}
        />
      )}

      {step === 2 && (
        <Step2Grade value={formData.gradeId} onNext={handleGradeNext} onBack={() => goToStep(1)} />
      )}

      {step === 3 && formData.gradeId && (
        <Step3Group
          key={formData.gradeId}
          gradeId={formData.gradeId}
          value={formData.groupId}
          onNext={handleGroupNext}
          onBack={() => goToStep(2)}
        />
      )}
      {step === 3 && !formData.gradeId && (
        <MissingStepsNotice onRestart={() => goToStep(1)} />
      )}

      {step === 4 && formData.gradeId && formData.groupId && (
        <Step4Payment
          value={formData.paymentMethod}
          onSubmit={handlePaymentSubmit}
          onBack={() => goToStep(3)}
          submitting={submitting}
          submitError={submitError}
        />
      )}
      {step === 4 && (!formData.gradeId || !formData.groupId) && (
        <MissingStepsNotice onRestart={() => goToStep(1)} />
      )}
    </div>
  );
}
