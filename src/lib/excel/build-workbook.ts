import "server-only";
import ExcelJS from "exceljs";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/labels";

interface BookingExportRow {
  booking_code: string;
  student_name: string;
  student_phone: string;
  guardian_phone: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  created_at: string;
  group_id: string;
  tutor_name?: string;
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

const STATUS_FILL: Record<string, string> = {
  paid: "FFC6EFCE",
  pending: "FFFFC7CE",
  expired: "FFD9D9D9",
  cancelled: "FFD9D9D9",
};

const STATUS_FONT: Record<string, string> = {
  paid: "FF006100",
  pending: "FF9C0006",
  expired: "FF595959",
  cancelled: "FF595959",
};

function buildColumns(includeTutorColumn: boolean) {
  return [
    ...(includeTutorColumn ? [{ header: "المدرّس", key: "tutor_name", width: 18 }] : []),
    { header: "كود الحجز", key: "booking_code", width: 16 },
    { header: "اسم الطالب", key: "student_name", width: 24 },
    { header: "رقم الطالب", key: "student_phone", width: 16 },
    { header: "رقم ولي الأمر", key: "guardian_phone", width: 16 },
    { header: "طريقة الدفع", key: "payment_method", width: 16 },
    { header: "حالة الدفع", key: "payment_status", width: 16 },
    { header: "المبلغ", key: "amount", width: 12 },
    { header: "تاريخ الحجز", key: "created_at", width: 18 },
  ];
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[*?:/\\[\]]/g, "").slice(0, 31) || "بيانات";
}

export async function buildBookingsWorkbook(params: {
  grades: GradeInfo[];
  groups: GroupInfo[];
  bookings: BookingExportRow[];
  includeTutorColumn?: boolean;
}): Promise<ExcelJS.Buffer> {
  const includeTutorColumn = params.includeTutorColumn ?? false;
  const columns = buildColumns(includeTutorColumn);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام حجز الدروس الخصوصية";
  workbook.created = new Date();

  const groupsByGrade = new Map<string, GroupInfo[]>();
  for (const group of params.groups) {
    const list = groupsByGrade.get(group.grade_id) ?? [];
    list.push(group);
    groupsByGrade.set(group.grade_id, list);
  }

  const bookingsByGroup = new Map<string, BookingExportRow[]>();
  for (const booking of params.bookings) {
    const list = bookingsByGroup.get(booking.group_id) ?? [];
    list.push(booking);
    bookingsByGroup.set(booking.group_id, list);
  }

  const sortedGrades = [...params.grades].sort((a, b) => a.display_order - b.display_order);

  for (const grade of sortedGrades) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(grade.name), {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    });

    const gradeGroups = groupsByGrade.get(grade.id) ?? [];

    for (const group of gradeGroups) {
      const groupBookings = bookingsByGroup.get(group.id) ?? [];

      const headerRow = sheet.addRow([`${group.name} — ${group.days} — ${group.time}`]);
      sheet.mergeCells(headerRow.number, 1, headerRow.number, columns.length);
      headerRow.font = { bold: true };
      headerRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };
      headerRow.getCell(1).alignment = { horizontal: "right" };

      if (groupBookings.length === 0) {
        const emptyRow = sheet.addRow(["لا توجد حجوزات في هذه المجموعة"]);
        sheet.mergeCells(emptyRow.number, 1, emptyRow.number, columns.length);
        emptyRow.getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
        emptyRow.getCell(1).alignment = { horizontal: "right" };
        continue;
      }

      for (const booking of groupBookings) {
        const row = sheet.addRow({
          tutor_name: booking.tutor_name,
          booking_code: booking.booking_code,
          student_name: booking.student_name,
          student_phone: booking.student_phone,
          guardian_phone: booking.guardian_phone,
          payment_method: PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method,
          payment_status: PAYMENT_STATUS_LABELS[booking.payment_status] ?? booking.payment_status,
          amount: booking.amount,
          created_at: new Date(booking.created_at).toLocaleString("ar-EG"),
        });

        const statusCell = row.getCell("payment_status");
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: STATUS_FILL[booking.payment_status] ?? "FFFFFFFF" },
        };
        statusCell.font = { color: { argb: STATUS_FONT[booking.payment_status] ?? "FF000000" } };
      }
    }
  }

  if (sortedGrades.length === 0) {
    workbook.addWorksheet("بيانات").addRow(["لا توجد بيانات"]);
  }

  return workbook.xlsx.writeBuffer();
}
