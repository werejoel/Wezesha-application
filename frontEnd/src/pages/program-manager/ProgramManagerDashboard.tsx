import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import {
  getDashboardStats,
  getYouth,
  getPartners,
  getSessions,
  getCases,
  getOutcomes,
  getReports,
  downloadExport,
} from "@/api";
import {
  Building2,
  Users,
  GraduationCap,
  FileText,
  Download,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DashboardFilterBreakdown } from "@/components/DashboardFilterBreakdown";
import { INSTITUTIONAL_SESSION_TOTAL } from "@/constants/regions";

const CHART_COLORS = [
  "hsl(152, 55%, 33%)",
  "hsl(38, 90%, 55%)",
  "hsl(210, 80%, 52%)",
  "hsl(0, 72%, 51%)",
];

const ProgramManagerDashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: youth } = useQuery({
    queryKey: ["youth"],
    queryFn: () => getYouth(),
  });

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => getPartners(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions(),
  });

  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCases(),
  });

  const { data: outcomes } = useQuery({
    queryKey: ["outcomes"],
    queryFn: () => getOutcomes(),
  });

  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports(),
  });

  const navigate = useNavigate();

  const downloadExportFile = async () => {
    const t = toast({
      title: "Preparing export",
      description: "Generating file...",
    });
    setExporting(true);
    try {
      const blob = await downloadExport("all");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "wezesha-data.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      t.dismiss();
      toast({
        title: "Export ready",
        description: "wezesha-data.xlsx downloaded",
      });
    } catch (error: any) {
      console.error("Export failed", error);
      t.dismiss();
      toast({
        title: "Export failed",
        description: error?.message || "Unable to export data.",
      });
    } finally {
      setExporting(false);
    }
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    const keys = [
      "dashboard-stats",
      "youth",
      "partners",
      "sessions",
      "cases",
      "outcomes",
      "reports",
    ];
    const t = toast({
      title: "Refreshing data",
      description: "Refreshing data in progress...",
    });
    setRefreshing(true);
    try {
      await Promise.all(
        keys.map((key) =>
          queryClient.invalidateQueries(key as any).catch(() => null),
        ),
      );
      t.dismiss();
      toast({
        title: "Refresh complete",
        description: "Program data refreshed.",
      });
      setRefreshing(false);
    } catch (e) {
      t.dismiss();
      toast({
        title: "Refresh failed",
        description: "Unable to refresh all data.",
      });
      setRefreshing(false);
    }
  };

  const handleQuickAction = async (label: string) => {
    switch (label) {
      case "Add Partner":
        navigate("/partners");
        break;
      case "Create Session":
        navigate("/sessions");
        break;
      case "View Reports":
        navigate("/reports");
        break;
      case "Export Data":
        await downloadExportFile();
        break;
      default:
        break;
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading dashboard...
      </div>
    );
  }

  // Calculate role distribution from partners data
  const roleData = [
    {
      name: "YBF",
      value: partners?.filter((p) => p.role === "YBF").length || 0,
    },
    {
      name: "Instructor",
      value: partners?.filter((p) => p.role === "Instructor").length || 0,
    },
    {
      name: "Enumerator",
      value: partners?.filter((p) => p.role === "Enumerator").length || 0,
    },
  ];

  const systemUsers = partners?.length + youth?.length || 0;

  // Recent activity mock data
  const recentActivity = [
    {
      id: 1,
      type: "success",
      message: "Session completed: Business Planning",
      time: "2h ago",
      status: "completed",
    },
    {
      id: 2,
      type: "info",
      message: "New youth enrolled: Sarah Johnson",
      time: "4h ago",
      status: "enrolled",
    },
    {
      id: 3,
      type: "warning",
      message: "Case note added: Follow-up required",
      time: "6h ago",
      status: "pending",
    },
    {
      id: 4,
      type: "success",
      message: "Outcome updated: Business started",
      time: "1d ago",
      status: "completed",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Program Manager Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor program progress and manage operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExportFile()}
          >
            {exporting ? (
              <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export Report
          </Button>
          <Button size="sm" onClick={handleRefresh}>
            {refreshing ? (
              <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Add Partner",
                icon: Building2,
                color: "bg-blue-600 hover:bg-blue-700",
              },
              {
                label: "Create Session",
                icon: Calendar,
                color: "bg-green-600 hover:bg-green-700",
              },
              {
                label: "View Reports",
                icon: FileText,
                color: "bg-purple-600 hover:bg-purple-700",
              },
              {
                label: "Export Data",
                icon: Download,
                color: "bg-orange-500 hover:bg-orange-600",
              },
            ].map((action) => (
              <Button
                key={action.label}
                className={`h-15 flex-col gap-2 justify-center text-white ${action.color}`}
                onClick={() => handleQuickAction(action.label)}
                disabled={action.label === "Export Data" && exporting}
              >
                <action.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Youth"
          value={stats?.totalYouth || 0}
          icon={Users}
          trend={{ value: 12, label: "increase" }}
          description="Active participants"
        />
        <StatCard
          title="Partner Institutions"
          value={stats?.totalPartners || 0}
          icon={Building2}
          trend={{ value: 8, label: "increase" }}
          description="Active partnerships"
        />
        <StatCard
          title="Avg Sessions / Youth"
          value={stats?.avgSessionsPerYouth ?? 0}
          icon={GraduationCap}
          trend={{ value: 15, label: "increase" }}
          description={`Of ${stats?.expectedSessionTotal ?? INSTITUTIONAL_SESSION_TOTAL} program sessions`}
        />
        <StatCard
          title="Youth at 80% Attendance"
          value={stats?.youthAt80Percent ?? 0}
          icon={Users}
          trend={{ value: 5, label: "increase" }}
          description="Attended ≥80% of sessions"
        />
        <StatCard
          title="Case Notes"
          value={stats?.totalCases || 0}
          icon={FileText}
          trend={{ value: 5, label: "increase" }}
          description="Active follow-ups"
        />
      </div>

      <DashboardFilterBreakdown breakdown={stats?.filterBreakdown} />

      {/* ── Program Overview + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Program Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                Program Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {youth?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Youth Enrolled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {sessions?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {cases?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Case Notes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {outcomes?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Outcomes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Attendance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                Session Attendance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={reports || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="session_date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stackId="1"
                    stroke={CHART_COLORS[0]}
                    fill={CHART_COLORS[0]}
                  />
                  <Area
                    type="monotone"
                    dataKey="absent"
                    stackId="1"
                    stroke={CHART_COLORS[1]}
                    fill={CHART_COLORS[1]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mt-2",
                      activity.type === "success" && "bg-green-500",
                      activity.type === "info" && "bg-blue-500",
                      activity.type === "warning" && "bg-yellow-500",
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  <Badge
                    variant={
                      activity.status === "completed"
                        ? "default"
                        : activity.status === "enrolled"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Partner Distribution + System Usage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partner Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">
              Partner Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {roleData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {roleData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-sm text-gray-600">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Usage Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">
              System Usage Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={[
                  { month: "Jan", users: 45 },
                  { month: "Feb", users: 52 },
                  { month: "Mar", users: 61 },
                  { month: "Apr", users: 58 },
                  { month: "May", users: 67 },
                  { month: "Jun", users: 74 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke={CHART_COLORS[2]}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProgramManagerDashboard;
