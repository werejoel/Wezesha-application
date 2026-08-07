import { useMemo, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  Users,
  CalendarCheck,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { downloadExport, getOutcomes, getReports, getYouth } from "@/api";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import "./reports.css";

const STATUS_COLORS = [
  "#16a34a",
  "#2563eb",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
];

const reportCategories = [
  {
    id: "attendance",
    title: "Session Attendance Report",
    description:
      "Attendance data by cohort, term, and session with present/absent/excused counts.",
    icon: CalendarCheck,
    filters: ["all", "cohort", "term"],
  },
  {
    id: "output",
    title: "Output Completion Report",
    description:
      "Track business plans, business ideas, and CVs across output milestones.",
    icon: FileText,
    filters: ["all", "Business Plan", "Business Ideas", "CV"],
  },
  {
    id: "enrollment",
    title: "Youth Enrollment Summary",
    description:
      "Demographics, program types, region distribution, and cohort enrollment trends.",
    icon: Users,
    filters: ["all", "gender", "programType"],
  },
  {
    id: "impact",
    title: "Outcome & Impact Report",
    description:
      "Employment and cohort-level delivery trends for program oversight.",
    icon: TrendingUp,
    filters: ["all", "programYear", "region"],
  },
];

const reportFilterLabels: Record<string, Record<string, string>> = {
  attendance: {
    all: "All Sessions",
    cohort: "By Cohort Year",
    term: "By Term",
  },
  output: {
    all: "All Milestones",
    "Business Plan": "Business Plan",
    "Business Ideas": "Business Ideas",
    CV: "CV",
  },
  enrollment: {
    all: "All Youth",
    gender: "By Gender",
    programType: "By Program Type",
  },
  impact: {
    all: "Full Impact",
    programYear: "By Program Year",
    region: "By Region",
  },
};

const formatDate = (value: string | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-UG");
};

const exportCsv = (filename: string, rows: any[]) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const headers = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row || {}))),
  );
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row?.[header] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<
    "attendance" | "output" | "enrollment" | "impact"
  >("attendance");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const reportsQuery = useQuery({
    queryKey: ["reports"] as const,
    queryFn: getReports,
  }) as UseQueryResult<any[], Error>;
  const youthQuery = useQuery({
    queryKey: ["youth"] as const,
    queryFn: () => getYouth(),
  }) as UseQueryResult<any[], Error>;
  const outcomesQuery = useQuery({
    queryKey: ["outcomes"] as const,
    queryFn: getOutcomes,
  }) as UseQueryResult<any[], Error>;

  const { data: reportsData = [], isLoading: reportsLoading } = reportsQuery;
  const { data: youthData = [], isLoading: youthLoading } = youthQuery;
  const { data: outcomesData = [], isLoading: outcomesLoading } = outcomesQuery;

  const isLoading = reportsLoading || youthLoading || outcomesLoading;

  const attendanceSummary = useMemo(() => {
    const totalSessions = reportsData.length;
    const totalPresent = reportsData.reduce(
      (sum: number, item: any) => sum + Number(item.present || 0),
      0,
    );
    const totalAbsent = reportsData.reduce(
      (sum: number, item: any) => sum + Number(item.absent || 0),
      0,
    );
    const totalExcused = reportsData.reduce(
      (sum: number, item: any) => sum + Number(item.excused || 0),
      0,
    );
    return { totalSessions, totalPresent, totalAbsent, totalExcused };
  }, [reportsData]);

  const normalizeOutcomeMilestoneType = (value: string) => {
    const normalized = String(value || "").trim();
    if (normalized.toLowerCase() === "cv") return "Business Ideas";
    if (normalized.toLowerCase() === "cover letter") return "CV";
    return normalized;
  };

  const milestoneSummary = useMemo(() => {
    const items = new Map<
      string,
      {
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
      }
    >();
    outcomesData.forEach((item: any) => {
      const milestoneType = normalizeOutcomeMilestoneType(item.milestone_type || "Unknown");
      if (!milestoneType) return;
      const current = items.get(milestoneType) || {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      };
      current.total += 1;
      if (item.status === "Completed") current.completed += 1;
      else if (item.status === "In Progress") current.inProgress += 1;
      else current.notStarted += 1;
      items.set(milestoneType, current);
    });
    return Array.from(items.entries()).map(([milestoneType, summary]) => ({
      milestoneType,
      ...summary,
    }));
  }, [outcomesData]);

  const youthByGender = useMemo<Record<string, number>>(() => {
    return (youthData as any[]).reduce(
      (acc: Record<string, number>, item: any) => {
        const gender = item.gender || "Unknown";
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [youthData]);

  const youthByProgram = useMemo<Record<string, number>>(() => {
    return (youthData as any[]).reduce(
      (acc: Record<string, number>, item: any) => {
        const program = item.program_type || item.programType || "Unknown";
        acc[program] = (acc[program] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [youthData]);

  const youthByRegion = useMemo<Record<string, number>>(() => {
    return (youthData as any[]).reduce(
      (acc: Record<string, number>, item: any) => {
        const region = item.region || "Unknown";
        acc[region] = (acc[region] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [youthData]);

  const outcomeStatusDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    outcomesData.forEach((item: any) => {
      const status = item.status || "Unknown";
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [outcomesData]);

  const filteredAttendance = useMemo(() => {
    const data = reportsData as any[];
    if (selectedFilter === "term") {
      const selectedTerm = data.length > 0 ? data[0].term_number : null;
      return selectedTerm == null
        ? data
        : data.filter((item) => item.term_number === selectedTerm);
    }
    if (selectedFilter === "cohort") {
      const selectedCohort = data.length > 0 ? data[0].cohort_year : null;
      return selectedCohort == null
        ? data
        : data.filter((item) => item.cohort_year === selectedCohort);
    }
    return data;
  }, [reportsData, selectedFilter]);

  const activeCategory = reportCategories.find(
    (item) => item.id === selectedReport,
  );

  const exportReportFile = async () => {
    try {
      const blob = await downloadExport("reports");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `wezesha-${selectedReport}-report.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Export ready",
        description: "Your report export is downloading.",
      });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err?.message || "Unable to download report.",
      });
    }
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1 className="page-title">Reports & Data Exports</h1>
        <p className="page-description">
          Generate reports for donor reporting, internal review, and impact
          tracking.
        </p>
      </div>

      {isLoading ? (
        <div className="reports-loading">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">Loading reports…</p>
        </div>
      ) : (
        <>
          <div className="reports-metrics-grid">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="reports-metric-card accent-green">
                    <p className="reports-metric-title">Sessions</p>
                    <p className="reports-metric-value">
                      {attendanceSummary.totalSessions}
                    </p>
                  </div>
                  <div className="reports-metric-card accent-blue">
                    <p className="reports-metric-title">Total Present</p>
                    <p className="reports-metric-value">
                      {attendanceSummary.totalPresent}
                    </p>
                  </div>
                  <div className="reports-metric-card accent-rose">
                    <p className="reports-metric-title">Total Absent</p>
                    <p className="reports-metric-value">
                      {attendanceSummary.totalAbsent}
                    </p>
                  </div>
                  <div className="reports-metric-card accent-yellow">
                    <p className="reports-metric-title">Total Excused</p>
                    <p className="reports-metric-value">
                      {attendanceSummary.totalExcused}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Enrollment Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="reports-metric-card accent-green">
                    <p className="reports-metric-title">Total Youth</p>
                    <p className="reports-metric-value">{youthData.length}</p>
                  </div>
                  <div className="reports-metric-card accent-blue">
                    <p className="reports-metric-title">Program Types</p>
                    <p className="reports-metric-value">
                      {Object.keys(youthByProgram).length}
                    </p>
                  </div>
                  <div className="reports-metric-card accent-yellow">
                    <p className="reports-metric-title">Regions</p>
                    <p className="reports-metric-value">
                      {Object.keys(youthByRegion).length}
                    </p>
                  </div>
                  <div className="reports-metric-card accent-rose">
                    <p className="reports-metric-title">Milestones Tracked</p>
                    <p className="reports-metric-value">
                      {milestoneSummary.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="reports-category-grid">
            {reportCategories.map((report) => {
              const isActive = report.id === selectedReport;
              return (
                <button
                  key={report.id}
                  type="button"
                  className={`reports-category-card reports-category-${report.id} rounded-2xl p-4 text-left transition-all ${isActive ? "active border-primary bg-primary/10 shadow-sm" : "border-border bg-background hover:border-primary/80"}`}
                  onClick={() => {
                    setSelectedReport(report.id as any);
                    setSelectedFilter("all");
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <report.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{report.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.filters.map((filter) => (
                      <span key={filter} className="reports-pill">
                        {filter === "all" ? "All Data" : filter}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base font-heading">
                  {activeCategory?.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {activeCategory?.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex flex-wrap gap-2">
                  {(activeCategory?.filters || []).map((filter) => (
                    <Button
                      key={filter}
                      variant={
                        selectedFilter === filter ? "secondary" : "outline"
                      }
                      size="sm"
                      className="h-9"
                      onClick={() => setSelectedFilter(filter)}
                    >
                      {reportFilterLabels[selectedReport]?.[filter] || filter}
                    </Button>
                  ))}
                </div>
                <Button size="sm" className="h-9" onClick={exportReportFile}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    exportCsv(
                      `${selectedReport}-report.csv`,
                      selectedReport === "attendance"
                        ? filteredAttendance
                        : selectedReport === "enrollment"
                          ? youthData
                          : selectedReport === "output"
                            ? outcomesData
                            : youthData,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedReport === "attendance" && (
                <div className="space-y-4">
                  <div className="overflow-x-auto reports-table-wrapper">
                    <table className="reports-table w-full table-auto border-collapse">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2">Session</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Cohort</th>
                          <th className="px-3 py-2">Term</th>
                          <th className="px-3 py-2">Present</th>
                          <th className="px-3 py-2">Absent</th>
                          <th className="px-3 py-2">Excused</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((item: any) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">{item.topic}</td>
                            <td className="px-3 py-2">
                              {formatDate(item.session_date)}
                            </td>
                            <td className="px-3 py-2">
                              {item.cohort_year || "Unknown"}
                            </td>
                            <td className="px-3 py-2">
                              {item.term_number || "N/A"}
                            </td>
                            <td className="px-3 py-2">{item.present ?? 0}</td>
                            <td className="px-3 py-2">{item.absent ?? 0}</td>
                            <td className="px-3 py-2">{item.excused ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReport === "output" && (
                <div className="reports-panel grid grid-cols-1 md:grid-cols-3 gap-4">
                  {milestoneSummary.map((item) => (
                    <div
                      key={item.milestoneType}
                      className="reports-panel-item"
                    >
                      <p className="text-sm font-semibold">
                        {item.milestoneType}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {item.total} milestones tracked
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Completed</span>
                          <span>{item.completed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>In progress</span>
                          <span>{item.inProgress}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Not started</span>
                          <span>{item.notStarted}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedReport === "enrollment" && (
                <div className="reports-panel grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Gender</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {Object.entries(youthByGender).map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between"
                        >
                          <span>{label}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Program Type</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {Object.entries(youthByProgram).map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between"
                        >
                          <span>{label}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Regions</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {Object.entries(youthByRegion)
                        .slice(0, 6)
                        .map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between"
                          >
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedReport === "impact" && (
                <div className="reports-panel grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Program reach</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {Object.entries(youthByProgram).map(
                        ([program, count]) => (
                          <div
                            key={program}
                            className="flex items-center justify-between"
                          >
                            <span>{program}</span>
                            <span>{count}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Youth distribution</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {Object.entries(youthByGender).map(([gender, count]) => (
                        <div
                          key={gender}
                          className="flex items-center justify-between"
                        >
                          <span>{gender}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="reports-panel-item">
                    <p className="text-sm font-semibold">Outcome milestone status</p>
                    <div className="mt-3 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={outcomeStatusDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {outcomeStatusDistribution.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
