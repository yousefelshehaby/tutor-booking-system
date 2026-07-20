export interface Settings {
  tutor_id: string;
  booking_open: boolean;
  monthly_payment_open: boolean;
  online_payments_enabled: boolean;
  current_month: string;
}

export interface EligibleBooking {
  booking_id: string;
  booking_code: string;
  student_name: string;
  student_phone: string;
  grade_name: string;
  group_name: string;
}

export interface MonthlyPaymentStatus {
  month: string;
  is_paid: boolean;
  amount: number;
  paid_at: string | null;
  payment_method: import("./booking").PaymentMethod | null;
}

export interface AccountStatementHeader {
  student_name: string;
  grade_name: string;
  group_name: string;
  group_days: string;
  group_time: string;
  booking_amount: number;
  booking_payment_status: import("./booking").PaymentStatus;
  booking_payment_method: import("./booking").PaymentMethod;
  booking_paid_at: string | null;
}
