import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { getDashboardStats, getYouth, getPartners, getSessions } from "@/api";
import {
    Building2, Users, UserCheck, GraduationCap, FileText, Target,
    Shield, Activity, Bell, Search, Download, RefreshCw, TrendingUp,
    TrendingDown, Clock, CheckCircle2, AlertCircle, ArrowUpRight,
    Calendar, MoreHorizontal, Zap, ServerCrash, Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const CHART_COLORS = ['hsl(152, 55%, 33%)', 'hsl(38, 90%, 55%)', 'hsl(210, 80%, 52%)', 'hsl(0, 72%, 51%)'];

const mockStats = {
    enrollmentByMonth: [
        { month: 'Jan', count: 12 },
        { month: 'Feb', count: 18 },
        { month: 'Mar', count: 25 },
        { month: 'Apr', count: 32 },
        { month: 'May', count: 28 },
        { month: 'Jun', count: 35 },
    ],
    systemUsage: [
        { month: 'Jan', users: 45 },
        { month: 'Feb', users: 52 },
        { month: 'Mar', users: 61 },
        { month: 'Apr', users: 58 },
        { month: 'May', users: 67 },
        { month: 'Jun', users: 74 },
    ],
    outcomeProgress: {
        inWork: 65,
        avgIncomeChange: 40,
        aboveIPL: 55,
        businessesStarted: 12,
    },
};

const genderData = [
    { name: 'Female', value: 25 },
    { name: 'Male', value: 30 },
];

const roleData = [
    { name: 'YBF', value: 15 },
    { name: 'Instructor', value: 8 },
    { name: 'Enumerator', value: 12 },
];

const cumulativeUsage = [
    { month: 'Jan', active: 45, inactive: 10 },
    { month: 'Feb', active: 52, inactive: 8 },
    { month: 'Mar', active: 61, inactive: 6 },
    { month: 'Apr', active: 58, inactive: 9 },
    { month: 'May', active: 67, inactive: 5 },
    { month: 'Jun', active: 74, inactive: 4 },
];

const radarData = [
    { subject: 'Uptime', A: 98 },
    { subject: 'Data Sync', A: 72 },
    { subject: 'User Adoption', A: 65 },
    { subject: 'Report Coverage', A: 80 },
    { subject: 'Session Logging', A: 88 },
    { subject: 'Case Mgmt', A: 55 },
];

const recentActivity = [
    { id: 1, type: 'success', message: 'New partner "Kampala Skills Hub" onboarded successfully', time: '5m ago', status: 'success' },
    { id: 2, type: 'alert', message: 'Data sync issue — 4 enumerator reports pending', time: '22m ago', status: 'danger' },
    { id: 3, type: 'info', message: 'User role updated: Grace Nakato → Instructor', time: '1h ago', status: 'info' },
    { id: 4, type: 'success', message: 'Monthly backup completed successfully', time: '3h ago', status: 'success' },
    { id: 5, type: 'alert', message: '3 sessions flagged with <50% attendance', time: '6h ago', status: 'danger' },
];

const systemAlerts = [
    {
        title: 'Low Attendance Alert',
        description: '3 sessions with < 50% attendance',
        severity: 'High',
        variant: 'destructive' as const,
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        titleColor: 'text-red-800 dark:text-red-300',
        descColor: 'text-red-600 dark:text-red-400',
    },
    {
        title: 'Data Sync Issue',
        description: 'Enumerator reports pending sync',
        severity: 'Medium',
        variant: 'secondary' as const,
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        border: 'border-yellow-200 dark:border-yellow-800',
        titleColor: 'text-yellow-800 dark:text-yellow-300',
        descColor: 'text-yellow-600 dark:text-yellow-400',
    },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
                <p className="font-medium text-foreground mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color }} className="text-xs">{p.name}: {p.value}</p>
                ))}
            </div>
        );
    }
    return null;
};

function SystemHealthGauge({ score }: { score: number }) {
    const color = score >= 85 ? 'hsl(152, 55%, 33%)' : score >= 60 ? 'hsl(38, 90%, 55%)' : 'hsl(0, 72%, 51%)';
    const label = score >= 85 ? 'Healthy' : score >= 60 ? 'Degraded' : 'Critical';
    return (
        <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={color} strokeWidth="3"
                        strokeDasharray={`${score} ${100 - score}`}
                        strokeLinecap="round"
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{score}</span>
            </div>
            <div>
                <p className="text-xs text-muted-foreground">System Health</p>
                <p className="text-sm font-semibold" style={{ color }}>{label}</p>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: getDashboardStats,
    });
    const { data: youthData, isLoading: youthLoading } = useQuery({
        queryKey: ['youth'],
        queryFn: getYouth,
    });
    const { data: partnersData, isLoading: partnersLoading } = useQuery({
        queryKey: ['partners'],
        queryFn: getPartners,
    });
    const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
        queryKey: ['sessions'],
        queryFn: getSessions,
    });

    if (statsLoading || youthLoading || partnersLoading || sessionsLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm">Loading admin dashboard…</p>
                </div>
            </div>
        );
    }

    const dashboardStats = stats || { totalYouth: 0, totalPartners: 0, totalSessions: 0, totalCases: 0 };
    const youth = youthData || [];
    const partners = partnersData || [];
    const sessions = sessionsData || [];

    // Calculate real data from backend
    const genderData = [
        { name: 'Female', value: youth.filter(y => y.gender === 'Female').length },
        { name: 'Male', value: youth.filter(y => y.gender === 'Male').length },
    ];

    // Calculate enrollment trend from youth data (group by month)
    const enrollmentByMonth = youth.reduce((acc, y) => {
        if (y.enrolment_date) {
            const date = new Date(y.enrolment_date);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
            const existing = acc.find(item => item.month === monthKey);
            if (existing) {
                existing.count += 1;
            } else {
                acc.push({ month: monthKey, count: 1 });
            }
        }
        return acc;
    }, [] as { month: string; count: number }[]).slice(0, 6);

    // Calculate role distribution from partners data
    const roleData = [
        { name: 'YBF', value: partners.filter(p => p.role === 'YBF').length },
        { name: 'Instructor', value: partners.filter(p => p.role === 'Instructor').length },
        { name: 'Enumerator', value: partners.filter(p => p.role === 'Enumerator').length },
    ];

    // Keep system usage as mock for now (could be from user activity logs)
    const systemUsage = [
        { month: 'Jan', users: 45 },
        { month: 'Feb', users: 52 },
        { month: 'Mar', users: 61 },
        { month: 'Apr', users: 58 },
        { month: 'May', users: 67 },
        { month: 'Jun', users: 74 },
    ];

    const atRiskYouth = youth.filter((y: any) => y.risk_flag || (y.attendance_rate && y.attendance_rate < 70)).slice(0, 5);
    const recentSessions = sessions.slice(0, 3);
    const systemUsers = partners.filter((p: any) => p.role !== 'Enumerator').length + youth.length;

    return (
        <div className="space-y-6 pb-10">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                            <Shield className="h-3 w-3" /> Admin
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                    <h1 className="page-title flex items-center gap-2">
                        Admin Dashboard
                    </h1>
                    <p className="page-description">System-wide overview and administrative controls</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Search users, logs…" className="pl-8 h-8 text-sm w-52" />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 relative">
                        <Bell className="h-3.5 w-3.5" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
                    </Button>
                </div>
            </div>

            {/* ── System Health Strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center justify-center lg:border-r border-border pr-0 lg:pr-4">
                    <SystemHealthGauge score={91} />
                </div>
                {[
                    { label: 'System Uptime', value: '99.2%', trend: '+0.4%', up: true },
                    { label: 'Active Users', value: systemUsers, trend: '+12', up: true },
                    { label: 'Pending Syncs', value: 4, trend: '+4', up: false },
                    { label: 'Open Alerts', value: systemAlerts.length, trend: '-1', up: false },
                ].map((item) => (
                    <div key={item.label} className="flex flex-col justify-center px-3 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-xl font-bold tracking-tight">{item.value}</p>
                        <div className={cn("flex items-center gap-1 text-xs font-medium mt-0.5", item.up ? "text-emerald-600" : "text-red-500")}>
                            {item.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {item.trend} vs last month
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Total Partners" value={dashboardStats.totalPartners} icon={Building2} variant="primary" />
                <StatCard title="Youth Enrolled" value={dashboardStats.totalYouth} icon={Users} variant="success" />
                <StatCard title="Active Sessions" value={dashboardStats.totalSessions} icon={GraduationCap} variant="warning" />
                <StatCard title="Active Cases" value={dashboardStats.totalCases} icon={FileText} variant="warning" />
                <StatCard title="System Users" value={systemUsers} icon={UserCheck} variant="default" />
            </div>

            {/* ── System Usage Trend + Role Distribution ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-heading">System Usage Trend</CardTitle>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Active</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(210, 80%, 52%)' }} /> Inactive</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={cumulativeUsage}>
                                <defs>
                                    <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(152, 55%, 33%)" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="hsl(152, 55%, 33%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradInactive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(210, 80%, 52%)" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="hsl(210, 80%, 52%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="active" name="Active" stroke="hsl(152, 55%, 33%)" strokeWidth={2} fill="url(#gradActive)" />
                                <Area type="monotone" dataKey="inactive" name="Inactive" stroke="hsl(210, 80%, 52%)" strokeWidth={2} fill="url(#gradInactive)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">User Roles Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center gap-3">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {roleData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 text-xs flex-wrap justify-center">
                            {roleData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                                    <span className="text-muted-foreground">{d.name}</span>
                                    <span className="font-semibold">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Enrollment Bar + Radar ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">Monthly Enrollment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={enrollmentByMonth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Enrolled" fill="hsl(152, 55%, 33%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">System Performance Radar</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={220}>
                            <RadarChart cx="50%" cy="50%" outerRadius={80} data={radarData}>
                                <PolarGrid stroke="hsl(40, 15%, 89%)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                <Radar name="Score" dataKey="A" stroke="hsl(152, 55%, 33%)" fill="hsl(152, 55%, 33%)" fillOpacity={0.2} strokeWidth={2} />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ── Recent Sessions + System Alerts + Activity Feed ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Recent Sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2.5">
                            {recentSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                                    <GraduationCap className="h-8 w-8 opacity-30" />
                                    <p className="text-sm">No sessions logged yet</p>
                                </div>
                            ) : recentSessions.map((session: any) => (
                                <div key={session.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <GraduationCap className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none">{session.title}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {session.partner} · {new Date(session.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] px-1.5">{session.status}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading text-destructive flex items-center gap-2">
                            ⚠ System Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2.5">
                            {systemAlerts.map((alert) => (
                                <div key={alert.title} className={cn("flex items-start justify-between p-2.5 rounded-lg border gap-3", alert.bg, alert.border)}>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-sm font-medium", alert.titleColor)}>{alert.title}</p>
                                        <p className={cn("text-xs mt-0.5", alert.descColor)}>{alert.description}</p>
                                    </div>
                                    <Badge variant={alert.variant} className="text-[10px] px-1.5 flex-shrink-0">{alert.severity}</Badge>
                                </div>
                            ))}
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">Last Backup</p>
                                        <p className="text-xs text-muted-foreground">Completed 3h ago</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 px-1.5">OK</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-heading flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" /> Recent Activity
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentActivity.map((item) => (
                                <div key={item.id} className="flex gap-3 items-start">
                                    <div className={cn("mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                                        item.status === 'success' && 'bg-primary/10',
                                        item.status === 'danger' && 'bg-destructive/10',
                                        item.status === 'info' && 'bg-blue-500/10',
                                    )}>
                                        {item.status === 'success' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                        {item.status === 'danger' && <AlertCircle className="h-3 w-3 text-destructive" />}
                                        {item.status === 'info' && <ArrowUpRight className="h-3 w-3 text-blue-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs leading-relaxed text-foreground line-clamp-2">{item.message}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Outcome Indicators + At-Risk ── */}
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
                                { label: 'Youth in Work', value: mockStats.outcomeProgress.inWork },
                                { label: 'Avg Income Change', value: mockStats.outcomeProgress.avgIncomeChange },
                                { label: 'Above Poverty Line', value: mockStats.outcomeProgress.aboveIPL },
                                { label: 'Businesses Started', value: mockStats.outcomeProgress.businessesStarted },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">{item.label}</span>
                                        <span className="font-semibold">{item.value}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${item.value}%` }} />
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
                        <div className="space-y-2.5">
                            {atRiskYouth.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-primary/40" />
                                    <p className="text-sm">No at-risk youth flagged</p>
                                </div>
                            ) : atRiskYouth.map((y: any) => (
                                <div key={y.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px] bg-destructive/10 text-destructive">
                                                {y.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium leading-none">{y.fullName}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{y.partner}</p>
                                        </div>
                                    </div>
                                    <Badge variant="destructive" className="text-[10px] px-1.5">{y.attendanceRate}%</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Quick Actions ── */}
            <Card className="border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading text-muted-foreground flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Admin Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {['Add Partner', 'Create User', 'Log Session', 'Manage Roles', 'Run Sync', 'Generate Report', 'View Audit Log', 'Export Data'].map((action) => (
                            <Button key={action} variant="outline" size="sm" className="text-xs h-7 gap-1">
                                {action} <ArrowUpRight className="h-3 w-3 opacity-50" />
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}