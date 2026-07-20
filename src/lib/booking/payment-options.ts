export interface OnlinePaymentOption {
  value: "card" | "wallet" | "fawry";
  label: string;
  icon: string;
}

export const ONLINE_METHOD_OPTIONS: OnlinePaymentOption[] = [
  { value: "card", label: "بطاقة بنكية", icon: "💳" },
  { value: "wallet", label: "محفظة إلكترونية", icon: "📱" },
  { value: "fawry", label: "فوري", icon: "🏪" },
];

export const ONLINE_PAYMENTS_COMING_SOON_NOTE = "الدفع الإلكتروني جاري تفعيله وسيتوفر قريبًا";

export const CASH_PAYMENT_EXPIRY_HINT = "يُرجى الدفع خلال 48 ساعة وإلا سيُلغى الحجز تلقائيًا";
