export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "بطاقة بنكية",
  wallet: "محفظة إلكترونية",
  fawry: "فوري",
  reserve_only: "حجز بدون دفع الآن",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "في انتظار الدفع",
  paid: "تم الدفع",
  expired: "انتهى",
  cancelled: "ملغي",
};
