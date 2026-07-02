import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  CalendarCheck,
  FolderOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useUser } from "@/hooks/use-user";
import { getDashboardStats } from "@/api";

type OutputProgress = {
  completed: number;
  inProgress: number;
  notStarted: number;
};

type DashboardData = {
  totalYouth: number;
  totalPartners: number;
  totalSessions: number;
  avgSessionsPerYouth?: number;
  youthAt80Percent?: number;
  expectedSessionTotal?: number;
  totalCases: number;
  atRiskCount: number;
  avgAttendance: number | null;
  outputProgress?: {
    businessPlan: OutputProgress;
    cv: OutputProgress;
    applicationLetter: OutputProgress;
  };
  sessionAttendance?: { session: string; date: string; attendance: number }[];
  cohorts?: { id: string; label: string; youthCount: number }[];
};

function milestoneTotal(p: OutputProgress) {
  return p.completed + p.inProgress + p.notStarted;
}

function milestonePct(p: OutputProgress) {
  const total = milestoneTotal(p);
  if (!total) return 0;
  return Math.round((p.completed / total) * 100);
}

export default function YBFDashboard() {
  const { user } = useUser();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<DashboardData>({
    queryKey: ["ybf-dashboard"],
    queryFn: getDashboardStats,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading your dashboard…
      </div>
    );
  }

  const dashboard = stats || {
    totalYouth: 0,
    totalPartners: 0,
    totalSessions: 0,
    totalCases: 0,
    atRiskCount: 0,
    avgAttendance: null,
  };

  const output = dashboard.outputProgress || {
    businessPlan: { completed: 0, inProgress: 0, notStarted: 0 },
    cv: { completed: 0, inProgress: 0, notStarted: 0 },
    applicationLetter: { completed: 0, inProgress: 0, notStarted: 0 },
  };

  const sessionChart = (dashboard.sessionAttendance || []).map((s) => ({
    name: s.session.length > 18 ? `${s.session.slice(0, 16)}…` : s.session,
    attendance: s.attendance,
  }));

  const outputItems = [
    { label: "Business Plans", key: output.businessPlan, icon: ClipboardList },
    { label: "CVs", key: output.cv, icon: CheckCircle2 },
    { label: "Cover Letters", key: output.applicationLetter, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">My Dashboard</h1>
        <p className="page-description">
          Welcome back, {user?.name}. Here is your cohort overview — attendance
          rates and output progress for your assigned youth.
        </p>
      </div>

      {dashboard.cohorts && dashboard.cohorts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dashboard.cohorts.map((c) => (
            <Badge key={c.id} variant="secondary" className="px-3 py-1">
              {c.label} · {c.youthCount} youth
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Youth"
          value={dashboard.totalYouth}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="My Institutions"
          value={dashboard.totalPartners}
          icon={Building2}
        />
        <StatCard
          title="Avg Attendance"
          value={
            dashboard.avgAttendance !== null
              ? `${Math.round(dashboard.avgAttendance)}%`
              : "—"
          }
          icon={CalendarCheck}
          variant="success"
        />
        <StatCard
          title="At-Risk Youth"
          value={dashboard.atRiskCount}
          subtitle="Attendance below 70%"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Youth Roster", path: "/youth", icon: Users },
          { label: "Session Schedule", path: "/sessions", icon: CalendarCheck },
          { label: "Case Management", path: "/cases", icon: FolderOpen },
          { label: "Output Tracking", path: "/outcomes", icon: TrendingUp },
        ].map((action) => (
          <Button
            key={action.path}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={() => navigate(action.path)}
          >
            <action.icon className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">{action.label}</span>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">
              Session Attendance Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Attendance"]} />
                  <Bar
                    dataKey="attendance"
                    fill="hsl(152, 55%, 33%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No session attendance data yet. Mark attendance from Session
                Schedule.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">
              Output Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {outputItems.map((item) => {
              const pct = milestonePct(item.key);
              const total = milestoneTotal(item.key);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {total > 0 ? `${pct}% complete` : "No data"}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.key.completed} completed · {item.key.inProgress} in
                    progress · {item.key.notStarted} not started
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Avg Sessions / Youth"
          value={dashboard.avgSessionsPerYouth ?? 0}
          subtitle={`Of ${dashboard.expectedSessionTotal ?? 18} sessions`}
          icon={CalendarCheck}
        />
        <StatCard
          title="Youth at 80% Attendance"
          value={dashboard.youthAt80Percent ?? 0}
          subtitle="Met attendance threshold"
          icon={Users}
        />
        <StatCard
          title="Case Notes"
          value={dashboard.totalCases}
          subtitle="Logged for your youth"
          icon={FolderOpen}
        />
      </div>
    </div>
  );
}
