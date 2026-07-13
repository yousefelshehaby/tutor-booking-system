import { z } from "zod";

// Egyptian mobile numbers: 01 + operator digit (0,1,2,5) + 8 digits = 11 digits total
const EGYPTIAN_PHONE_REGEX = /^01[0125][0-9]{8}$/;

export const nameSchema = z
  .string()
  .trim()
  .min(1, "الاسم مطلوب")
  .refine(
    (value) => value.split(/\s+/).filter(Boolean).length >= 3,
    "من فضلك أدخل الاسم ثلاثي على الأقل"
  );

export const phoneSchema = z
  .string()
  .trim()
  .regex(EGYPTIAN_PHONE_REGEX, "رقم الهاتف غير صحيح، يجب أن يبدأ بـ 01 ويتكون من 11 رقم");

export const personalInfoSchema = z
  .object({
    studentName: nameSchema,
    studentPhone: phoneSchema,
    guardianPhone: phoneSchema,
  })
  .refine((data) => data.studentPhone !== data.guardianPhone, {
    message: "رقم ولي الأمر يجب أن يكون مختلفًا عن رقم الطالب",
    path: ["guardianPhone"],
  });

export const paymentMethodSchema = z.enum(["card", "wallet", "fawry", "reserve_only"]);

export const bookingSubmitSchema = z
  .object({
    tutorId: z.uuid(),
    studentName: nameSchema,
    studentPhone: phoneSchema,
    guardianPhone: phoneSchema,
    gradeId: z.uuid("من فضلك اختر الصف الدراسي"),
    groupId: z.uuid("من فضلك اختر المجموعة"),
    paymentMethod: paymentMethodSchema,
  })
  .refine((data) => data.studentPhone !== data.guardianPhone, {
    message: "رقم ولي الأمر يجب أن يكون مختلفًا عن رقم الطالب",
    path: ["guardianPhone"],
  });

export type BookingSubmitInput = z.infer<typeof bookingSubmitSchema>;
