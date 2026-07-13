"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { retryPayment } from "@/lib/booking/retry-payment";

export function RetryPaymentButton({ bookingCode }: { bookingCode: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const result = await retryPayment(bookingCode);

    if (result.type === "error") {
      setError(result.message);
      setLoading(false);
      return;
    }

    if (result.type === "redirect") {
      window.location.href = result.url;
      return;
    }

    router.push(
      `/payment/fawry?code=${encodeURIComponent(bookingCode)}&ref=${encodeURIComponent(result.billReference)}`
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? "جاري التحويل..." : "ادفع الآن"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
