export type PaymentMethod = "card" | "wallet" | "fawry" | "reserve_only";

export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled";

export interface Grade {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface GroupWithAvailability {
  id: string;
  name: string;
  days: string;
  time: string;
  price: number;
  capacity: number;
  remaining_seats: number;
}

export interface PersonalInfo {
  studentName: string;
  studentPhone: string;
  guardianPhone: string;
}

export interface BookingFormData extends PersonalInfo {
  gradeId: string | null;
  groupId: string | null;
  paymentMethod: PaymentMethod | null;
}

export interface BookingDetails {
  booking_code: string;
  student_name: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  expires_at: string | null;
  created_at: string;
  grade_name: string;
  group_name: string;
  group_days: string;
  group_time: string;
}
