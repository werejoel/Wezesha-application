import { StatCard } from "@/components/StatCard";
import { dashboardStats, youth } from "@/data/mockData";
import { Building2, Users, UserCheck, GraduationCap, Briefcase, TrendingUp, FileText, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

const CHART_COLORS = ['hsl(152, 55%, 33%)', 'hsl(38, 90%, 55%)', 'hsl(210, 80%, 52%)', 'hsl(0, 72%, 51%)'];

const genderData = [
  { name: 'Female', value: dashboardStats.youthByGender.female },
  { name: 'Male', value: dashboardStats.youthByGender.male },
];

const outputData = [
  { name: 'Business Plan', completed: dashboardStats.outputProgress.businessPlan },
  { name: 'CV', completed: dashboardStats.outputProgress.cv },
  { name: 'Application Letter', completed: dashboardStats.outputProgress.applicationLetter },
];

const atRiskYouth = youth.filter(y => y.riskFlag).slice(0, 5);

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Program Dashboard</h1>
        <p className="page-description">Real-time overview of Wezesha Impact program performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Partners"
          value={dashboardStats.totalPartners.tvet + dashboardStats.totalPartners.cbo}
          subtitle={`${dashboardStats.totalPartners.tvet} TVETs · ${dashboardStats.totalPartners.cbo} CBOs`}
          icon={Building2}
          variant="primary"
        />
        <StatCard
          title="Youth Enrolled"
          value={dashboardStats.totalYouth}
          subtitle={`${dashboardStats.youthByGender.female} Female · ${dashboardStats.youthByGender.male} Male`}
          icon={Users}
          trend={{ value: 12, label: 'this quarter' }}
          variant="success"
        />
        <StatCard
          title="Attendance Rate"
          value={`${dashboardStats.overallAttendance}%`}
          subtitle="Above 80% threshold"
          icon={UserCheck}
          variant="primary"
        />
        <StatCard
          title="In Work"
          value={`${dashboardStats.outcomeProgress.inWork}%`}
          subtitle="Employed or self-employed"
          icon={Briefcase}
          trend={{ value: 8, label: 'from baseline' }}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Enrollment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dashboardStats.enrollmentByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(152, 55%, 33%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Attendance by Session</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dashboardStats.attendanceByTerm}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="hsl(152, 55%, 33%)" strokeWidth={2} dot={{ fill: 'hsl(152, 55%, 33%)' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Output Completion (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outputData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(38, 90%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Outcome Indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Youth in Work', value: dashboardStats.outcomeProgress.inWork },
                { label: 'Avg Income Change', value: dashboardStats.outcomeProgress.avgIncomeChange },
                { label: 'Above Poverty Line', value: dashboardStats.outcomeProgress.aboveIPL },
                { label: 'Businesses Started', value: dashboardStats.outcomeProgress.businessesStarted },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading text-destructive flex items-center gap-2">
              ⚠ At-Risk Youth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRiskYouth.map(y => (
                <div key={y.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{y.fullName}</p>
                    <p className="text-xs text-muted-foreground">{y.partner}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{y.attendanceRate}% attendance</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
