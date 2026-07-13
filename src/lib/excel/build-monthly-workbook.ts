import "server-only";
import ExcelJS from "exceljs";
import { formatMonth } from "@/lib/utils/format-month";

interface BookingInfo {
  id: string;
  booking_code: string;
  student_name: string;
  grade_id: string;
  group_id: string;
  created_at: string;
}

interface GroupInfo {
  id: string;
  grade_id: string;
  name: string;
  days: string;
  time: string;
}

interface GradeInfo {
  id: string;
  name: string;
  display_order: number;
}

interface MonthlyPaymentInfo {
  booking_id: string;
  month: string;
  payment_status: string;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[*?:/\\[\]]/g, "").slice(0, 31) || "بيانات";
}

function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [endY, endM] = end.split("-").map(Number);

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return months;
}

export async function buildMonthlyWorkbook(params: {
  grades: GradeInfo[];
  groups: GroupInfo[];
  bookings: BookingInfo[];
  monthlyPayments: MonthlyPaymentInfo[];
  currentMonth: string;
}): Promise<ExcelJS.Buffer> {
  const { grades, groups, bookings, monthlyPayments, currentMonth } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام حجز الدروس الخصوصية";
  workbook.created = new Date();

  if (bookings.length === 0) {
    workbook.addWorksheet("بيانات").addRow(["لا يوجد طلاب مسجلين"]);
    return workbook.xlsx.writeBuffer();
  }

  const earliestMonth = bookings
    .map((b) => b.created_at.slice(0, 7))
    .sort()[0];
  const months = monthRange(earliestMonth, currentMonth);

  const paidSet = new Set(
    monthlyPayments.filter((mp) => mp.payment_status === "paid").map((mp) => `${mp.booking_id}:${mp.month}`)
  );

  const groupsByGrade = new Map<string, GroupInfo[]>();
  for (const group of groups) {
    const list = groupsByGrade.get(group.grade_id) ?? [];
    list.push(group);
    groupsByGrade.set(group.grade_id, list);
  }

  const bookingsByGroup = new Map<string, BookingInfo[]>();
  for (const booking of bookings) {
    const list = bookingsByGroup.get(booking.group_id) ?? [];
    list.push(booking);
    bookingsByGroup.set(booking.group_id, list);
  }

  const columns = [
    { header: "كود الحجز", key: "booking_code", width: 16 },
    { header: "اسم الطالب", key: "student_name", width: 24 },
    ...months.map((m) => ({ header: formatMonth(m), key: m, width: 14 })),
  ];

  const sortedGrades = [...grades].sort((a, b) => a.display_order - b.display_order);

  for (const grade of sortedGrades) {
    const gradeGroups = groupsByGrade.get(grade.id) ?? [];
    const hasStudents = gradeGroups.some((g) => (bookingsByGroup.get(g.id) ?? []).length > 0);
    if (!hasStudents) continue;

    const sheet = workbook.addWorksheet(sanitizeSheetName(grade.name), {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    });

    for (const group of gradeGroups) {
      const groupBookings = bookingsByGroup.get(group.id) ?? [];
      if (groupBookings.length === 0) continue;

      const headerRow = sheet.addRow([`${group.name} — ${group.days} — ${group.time}`]);
      sheet.mergeCells(headerRow.number, 1, headerRow.number, columns.length);
      headerRow.font = { bold: true };
      headerRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };
      headerRow.getCell(1).alignment = { horizontal: "right" };

      for (const booking of groupBookings) {
        const rowData: Record<string, string> = {
          booking_code: booking.booking_code,
          student_name: booking.student_name,
        };

        const row = sheet.addRow(rowData);

        for (const m of months) {
          const cell = row.getCell(m);
          const enrolled = m >= booking.created_at.slice(0, 7);
          if (!enrolled) {
            cell.value = "—";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
            cell.font = { color: { argb: "FF9CA3AF" } };
            continue;
          }

          const isPaid = paidSet.has(`${booking.id}:${m}`);
          cell.value = isPaid ? "مدفوع" : "غير مدفوع";
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isPaid ? "FFC6EFCE" : "FFFFC7CE" },
          };
          cell.font = { color: { argb: isPaid ? "FF006100" : "FF9C0006" } };
        }
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}
