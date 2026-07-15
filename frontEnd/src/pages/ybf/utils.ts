export const MILESTONE_TYPES = [
  "Application Letter & Business Plan",
  "Business Ideas",
  "CV",
] as const;

export const MILESTONE_STATUSES = [
  "Not Started",
  "In Progress",
  "Completed",
] as const;

export const ATTENDANCE_STATUSES = ["Present", "Absent", "Excused"] as const;

export const YBF_CASE_CATEGORIES = [
  "General Update",
  "At-Risk Flag",
  "Business Support",
  "Field Visit",
  "Employment Lead",
  "Other",
] as const;

export type MilestoneType = (typeof MILESTONE_TYPES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const normalizeMilestoneType = (value: string): MilestoneType | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("application letter") || normalized.includes("business plan") || normalized.includes("cover letter")) {
    return "Application Letter & Business Plan";
  }
  if (normalized.includes("business idea")) return "Business Ideas";
  if (normalized.includes("cv")) return "CV";
  return null;
};

export const buildCalendarLink = ({
  topic,
  date,
  venue,
  partner,
}: {
  topic: string;
  date: string;
  venue?: string;
  partner?: string;
}) => {
  const title = encodeURIComponent(`${topic} — YBF Session`);
  const details = encodeURIComponent(
    [partner ? `Partner: ${partner}` : null, venue ? `Venue: ${venue}` : null]
      .filter(Boolean)
      .join("\n"),
  );
  const start = new Date(`${date}T09:00:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const end = new Date(`${date}T10:00:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
};

export const categoryColors: Record<string, string> = {
  "General Update": "bg-info text-info-foreground",
  "At-Risk Flag": "bg-destructive text-destructive-foreground",
  "Business Support": "bg-success text-success-foreground",
  "Field Visit": "bg-primary text-primary-foreground",
  "Employment Lead": "bg-warning text-warning-foreground",
  Other: "bg-muted text-muted-foreground",
};

export const milestoneStatusColor = (status: string) => {
  if (status === "Completed") return "bg-success";
  if (status === "In Progress") return "bg-warning";
  return "bg-muted";
};

export function normalizeYouthRow(item: any) {
  return {
    id: String(item.id ?? ""),
    fullName: item.full_name || item.fullName || "Unknown",
    dob: item.date_of_birth || item.dob || "",
    gender: item.gender || "",
    district: item.district || item.district_of_residence || "",
    partner: item.partner_name || item.partner || "",
    cohort: item.cohort_year
      ? `Cohort ${item.cohort_year}`
      : item.cohort || "",
    programType: item.program_type || item.programType || "",
    attendanceRate: Number(item.attendance_rate ?? item.attendanceRate ?? 0),
    riskFlag: Boolean(item.risk_flag ?? item.riskFlag ?? false),
    cohortId: String(item.cohort_id ?? ""),
  };
}

export function normalizeSessionRow(item: any) {
  const total = Number(item.total_youth ?? item.totalYouth ?? 0);
  const present = Number(item.attendance_count ?? item.attendanceCount ?? 0);
  return {
    id: String(item.id),
    topic: item.topic || "",
    date: item.session_date
      ? String(item.session_date).split("T")[0]
      : item.date || "",
    partner: item.partner_name || item.partner || "",
    facilitator: item.facilitator || "",
    venue: item.venue || "",
    term: item.term || `Term ${item.term_number || 1}`,
    sessionNumber: Number(item.session_number ?? item.sessionNumber ?? 0),
    cohortId: String(item.cohort_id ?? ""),
    attendanceCount: present,
    totalYouth: total,
    attendancePct: total > 0 ? Math.round((present / total) * 100) : 0,
    dataEntryDeadline: item.data_entry_deadline
      ? String(item.data_entry_deadline).split("T")[0]
      : null,
    isLocked: Boolean(item.is_locked ?? item.isLocked),
    daysRemaining:
      item.days_remaining != null ? Number(item.days_remaining) : null,
    expectedSessionTotal: Number(
      item.expected_session_total ?? item.expectedSessionTotal ?? 18,
    ),
  };
}

export function normalizeCaseNote(item: any) {
  return {
    id: String(item.id),
    youthId: String(item.youth_id || item.youthId || ""),
    youthName:
      item.youth_name ||
      item.youth_full_name ||
      item.youthName ||
      `Youth ${item.youth_id || ""}`,
    author: item.author_name || item.author || "Unknown",
    date: item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : item.date || "",
    category: item.category || "Other",
    note: item.note_text || item.note || "",
    followUpDate: item.follow_up_due
      ? String(item.follow_up_due).split("T")[0]
      : undefined,
    followUpRequired: Boolean(item.follow_up_required),
  };
}
