export interface Settings {
  tutor_id: string;
  booking_open: boolean;
  monthly_payment_open: boolean;
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
}
