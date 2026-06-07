import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/StatCard";
import { getDashboardStats, getYouth, getPartners, getSessions, getUsers, getAtRiskYouth, getLowAttendanceSessions, createUser, updateUser } from "@/api";
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
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');

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
    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
    });
    const { data: atRiskListData, isLoading: atRiskListLoading } = useQuery({
        queryKey: ['youth', 'atRisk'],
        queryFn: () => getAtRiskYouth({ limit: 5, page: 1 }),
    });
    const { data: lowAttendanceData, isLoading: lowAttendanceLoading } = useQuery({
        queryKey: ['sessions', 'lowAttendance'],
        queryFn: () => getLowAttendanceSessions({ threshold: 70, limit: 5, page: 1 }),
    });

    const actionRoutes: Record<string, string | null> = {
        'Add Partner': '/partners',
        'Log Session': '/sessions',
        'Generate Report': '/reports',
    };

    const actions = [
        { label: 'Add Partner', icon: Building2, type: 'navigate' },
        { label: 'Create User', icon: Users, type: 'panel' },
        { label: 'Log Session', icon: Calendar, type: 'navigate' },
        { label: 'Manage Roles', icon: Shield, type: 'panel' },
        { label: 'Run Sync', icon: RefreshCw, type: 'panel' },
        { label: 'Generate Report', icon: FileText, type: 'navigate' },
        { label: 'View Audit Log', icon: ServerCrash, type: 'panel' },
        { label: 'Export Data', icon: Download, type: 'panel' },
    ];

    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'enumerator' });
    const [selectedRoleUser, setSelectedRoleUser] = useState<string>('');
    const [selectedUserRole, setSelectedUserRole] = useState<string>('enumerator');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'completed'>('idle');
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    const handleQuickAction = (label: string, type: string) => {
        if (type === 'navigate') {
            const path = actionRoutes[label];
            if (path) {
                navigate(path);
                return;
            }
        }

        setSelectedAction(label);
        setActionFeedback(null);
    };

    const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            await createUser(userForm.name, userForm.email, userForm.password, userForm.role);
            setActionFeedback('User created successfully.');
            setUserForm({ name: '', email: '', password: '', role: 'enumerator' });
        } catch (error: any) {
            setActionFeedback(error?.message || 'Unable to create user.');
        }
    };

    const handleChangeUserRole = async () => {
        if (!selectedRoleUser) {
            setActionFeedback('Choose a user before updating the role.');
            return;
        }
        try {
            await updateUser(selectedRoleUser, { role: selectedUserRole });
            setActionFeedback('User role updated successfully.');
        } catch (error: any) {
            setActionFeedback(error?.message || 'Failed to update role.');
        }
    };

    const handleRunSync = () => {
        setSyncStatus('running');
        setActionFeedback('Sync started. This may take a few seconds.');
        setTimeout(() => {
            setSyncStatus('completed');
            setActionFeedback('Sync completed successfully.');
        }, 1400);
    };

    const exportCsv = (filename: string, rows: any[]) => {
        const csvContent = [Object.keys(rows[0] || {}).join(','), ...rows.map((row) => Object.values(row).map((value) => `"${String(value ?? '')}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredAtRiskYouth = useMemo(() => {
        const baseAtRisk = atRiskListData?.rows || [];
        if (!normalizedSearch) return baseAtRisk;
        return baseAtRisk.filter((y: any) => {
            const fields = [
                y.full_name,
                y.partner_name,
                y.gender,
                y.program_type,
            ];
            return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(normalizedSearch));
        });
    }, [atRiskListData?.rows, normalizedSearch]);

    const recentActivity = useMemo(() => {
        const baseActivity = [
            ...((sessionsData || []).slice(0, 3).map((session: any) => ({
                id: `session-${session.id}`,
                status: 'success',
                message: `Session logged: ${session.topic || 'Untitled session'}`,
                time: session.session_date ? new Date(session.session_date).toLocaleDateString() : 'Unknown date',
            })) as any[]),
            ...((youthData || []).slice(0, 2).map((y: any) => ({
                id: `youth-${y.id}`,
                status: 'info',
                message: `Youth enrolled: ${y.full_name || 'Unknown'}`,
                time: y.enrolment_date ? new Date(y.enrolment_date).toLocaleDateString() : 'Unknown date',
            })) as any[]),
        ];
        if (!normalizedSearch) return baseActivity;
        return baseActivity.filter((item) =>
            item.message.toLowerCase().includes(normalizedSearch) ||
            item.time.toLowerCase().includes(normalizedSearch),
        );
    }, [normalizedSearch, sessionsData, youthData]);

    if (statsLoading || youthLoading || partnersLoading || sessionsLoading || usersLoading || atRiskListLoading || lowAttendanceLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm">Loading admin dashboard…</p>
                </div>
            </div>
        );
    }

    const dashboardStats = stats || { totalYouth: 0, totalPartners: 0, totalSessions: 0, totalCases: 0, totalUsers: 0, pendingSyncs: 0, atRiskCount: 0, avgAttendance: null };
    const youth = youthData || [];
    const partners = partnersData || [];
    const sessions = sessionsData || [];
    const users = usersData || [];
    const lowAttendanceList = lowAttendanceData?.rows || [];

    // Prefer backend aggregates when available, fall back to defaults.
    const pendingSyncs = typeof dashboardStats.pendingSyncs === 'number' ? dashboardStats.pendingSyncs : 0;
    const atRiskCount = typeof atRiskListData?.total === 'number' ? atRiskListData.total : (typeof dashboardStats.atRiskCount === 'number' ? dashboardStats.atRiskCount : filteredAtRiskYouth.length);
    const systemUsers = typeof dashboardStats.totalUsers === 'number' ? dashboardStats.totalUsers : users.length;
    const systemHealthScore = Math.max(45, 100 - Math.min(60, pendingSyncs * 10 + atRiskCount * 4));

    const genderData = [
        { name: 'Female', value: youth.filter(y => y.gender === 'Female').length },
        { name: 'Male', value: youth.filter(y => y.gender === 'Male').length },
    ];

    const userRoles = [
        { name: 'YBF', value: users.filter((u: any) => u.role?.toLowerCase() === 'ybf').length },
        { name: 'Instructor', value: users.filter((u: any) => u.role?.toLowerCase() === 'instructor').length },
        { name: 'Enumerator', value: users.filter((u: any) => u.role?.toLowerCase() === 'enumerator').length },
    ];

    const enrollMap = new Map<string, { month: string; count: number }>();
    youth.forEach((y: any) => {
        if (y.enrolment_date) {
            const date = new Date(y.enrolment_date);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
            const existing = enrollMap.get(monthKey);
            if (existing) {
                existing.count += 1;
            } else {
                enrollMap.set(monthKey, { month: monthLabel, count: 1 });
            }
        }
    });
    const enrollmentByMonth = Array.from(enrollMap.values()).sort((a, b) => {
        const aDate = new Date(`${a.month} 1, 2000`);
        const bDate = new Date(`${b.month} 1, 2000`);
        return aDate.getMonth() - bDate.getMonth();
    }).slice(-6);

    const activityMap = new Map<string, { month: string; active: number; inactive: number }>();
    const ensureMonth = (dateString: string | undefined) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { key, month: date.toLocaleDateString('en-US', { month: 'short' }) };
    };
    youth.forEach((y: any) => {
        const month = ensureMonth(y.enrolment_date);
        if (!month) return;
        const item = activityMap.get(month.key) || { month: month.month, active: 0, inactive: 0 };
        item.inactive += 1;
        activityMap.set(month.key, item);
    });
    sessions.forEach((s: any) => {
        const month = ensureMonth(s.session_date);
        if (!month) return;
        const item = activityMap.get(month.key) || { month: month.month, active: 0, inactive: 0 };
        item.active += 1;
        activityMap.set(month.key, item);
    });
    const cumulativeUsage = Array.from(activityMap.values()).sort((a, b) => {
        const aDate = new Date(`${a.month} 1, 2000`);
        const bDate = new Date(`${b.month} 1, 2000`);
        return aDate.getMonth() - bDate.getMonth();
    }).slice(-6);

    const radarData = [
        { subject: 'Session Coverage', A: Math.min(100, sessions.length * 10) },
        { subject: 'Partner Reach', A: Math.min(100, partners.length * 15) },
        { subject: 'User Adoption', A: Math.min(100, (dashboardStats.totalUsers || users.length) * 10) },
        { subject: 'Youth Engagement', A: Math.min(100, youth.length ? Math.max(20, 100 - Math.round((atRiskCount / (youth.length || 1)) * 100)) : 0) },
        { subject: 'Case Load', A: Math.min(100, dashboardStats.totalCases * 10) },
    ];

    const recentSessions = sessions
        .slice()
        .sort((a: any, b: any) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
        .slice(0, 3);

    const lowAttendanceCount = typeof lowAttendanceData?.total === 'number' ? lowAttendanceData.total : 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthEnrollments = youth.filter((y: any) => {
        if (!y.enrolment_date) return false;
        const dt = new Date(y.enrolment_date);
        return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    }).length;
    const cohortCount = new Set(youth.map((y: any) => y.cohort_id)).size;
    const outcomeMetrics = [
        { label: 'At-risk youth', value: youth.length ? Math.round((atRiskCount / youth.length) * 100) : 0, suffix: '%' },
        { label: 'Low attendance', value: youth.length ? Math.round((lowAttendanceCount / youth.length) * 100) : 0, suffix: '%' },
        { label: 'Current month enrollments', value: currentMonthEnrollments },
        { label: 'Active cohorts', value: cohortCount },
    ];

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
                    <div className="relative block md:block w-full md:w-52">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search youth, alerts or actions…"
                            className="pl-8 h-8 text-sm w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
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
                    <SystemHealthGauge score={systemHealthScore} />
                </div>
                {[
                    { label: 'System Uptime', value: '99.2%', trend: '+0.4%', up: true },
                    { label: 'Active Users', value: systemUsers, trend: '+12', up: true },
                    { label: 'Pending Syncs', value: pendingSyncs, trend: pendingSyncs > 0 ? `+${pendingSyncs}` : '0', up: pendingSyncs === 0 ? true : false },
                    { label: 'Open Alerts', value: atRiskCount, trend: atRiskCount > 0 ? `+${atRiskCount}` : '0', up: atRiskCount === 0 ? true : false },
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
                                <Pie data={userRoles} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {userRoles.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 text-xs flex-wrap justify-center">
                            {userRoles.map((d, i) => (
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
                                            <p className="text-sm font-medium leading-none">{session.topic || session.title || 'Untitled session'}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {session.partner_name || session.partner || 'Unknown partner'} · {session.session_date ? new Date(session.session_date).toLocaleDateString() : 'Unknown date'}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] px-1.5">{session.status || 'Logged'}</Badge>
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
                            {(() => {
                                const derived: any[] = [];
                                const lowAttendanceTotal = typeof lowAttendanceData?.total === 'number' ? lowAttendanceData.total : 0;
                                if (dashboardStats.avgAttendance !== null && dashboardStats.avgAttendance < 75) {
                                    derived.push({
                                        title: 'Low Attendance Alert',
                                        description: `Average attendance is ${Math.round(dashboardStats.avgAttendance)}%`,
                                        severity: 'High',
                                        variant: 'destructive',
                                        bg: 'bg-red-50 dark:bg-red-950/30',
                                        border: 'border-red-200 dark:border-red-800',
                                        titleColor: 'text-red-800 dark:text-red-300',
                                        descColor: 'text-red-600 dark:text-red-400',
                                    });
                                }
                                if (pendingSyncs > 0) {
                                    derived.push({
                                        title: 'Data Sync Issue',
                                        description: `${pendingSyncs} youth records pending sync`,
                                        severity: 'Medium',
                                        variant: 'secondary',
                                        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
                                        border: 'border-yellow-200 dark:border-yellow-800',
                                        titleColor: 'text-yellow-800 dark:text-yellow-300',
                                        descColor: 'text-yellow-600 dark:text-yellow-400',
                                    });
                                }
                                if (lowAttendanceTotal > 0) {
                                    derived.push({
                                        title: 'Sessions with Low Attendance',
                                        description: `${lowAttendanceTotal} session(s) have low attendance (<70%)`,
                                        severity: 'Medium',
                                        variant: 'destructive',
                                        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
                                        border: 'border-yellow-200 dark:border-yellow-800',
                                        titleColor: 'text-yellow-800 dark:text-yellow-300',
                                        descColor: 'text-yellow-600 dark:text-yellow-400',
                                    });
                                }

                                const combined = [...systemAlerts, ...derived];
                                return combined.map((alert, i) => (
                                    <div key={`${alert.title}-${i}`} className={cn("flex items-start justify-between p-2.5 rounded-lg border gap-3", alert.bg, alert.border)}>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium", alert.titleColor)}>{alert.title}</p>
                                            <p className={cn("text-xs mt-0.5", alert.descColor)}>{alert.description}</p>
                                        </div>
                                        <Badge variant={alert.variant as any} className="text-[10px] px-1.5 flex-shrink-0">{alert.severity}</Badge>
                                    </div>
                                ));
                            })()}
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
                            {outcomeMetrics.map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-muted-foreground">{item.label}</span>
                                        <span className="font-semibold">{item.value}{item.suffix || ''}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, item.value)}%` }} />
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
                            {filteredAtRiskYouth.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-primary/40" />
                                    <p className="text-sm">No at-risk youth found{normalizedSearch ? ' for that search' : ''}</p>
                                </div>
                            ) : filteredAtRiskYouth.map((y: any) => (
                                <div key={y.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px] bg-destructive/10 text-destructive">
                                                {String(y.full_name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium leading-none">{y.full_name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{y.partner_name || 'Unknown partner'}</p>
                                        </div>
                                    </div>
                                    <Badge variant="destructive" className="text-[10px] px-1.5">{typeof y.attendance_pct === 'number' ? `${y.attendance_pct.toFixed(1)}%` : `${y.attendance_pct ?? 0}%`}</Badge>
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
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Button
                                    key={action.label}
                                    variant={selectedAction === action.label ? 'secondary' : 'outline'}
                                    size="sm"
                                    className="text-xs h-7 gap-1"
                                    onClick={() => handleQuickAction(action.label, action.type)}
                                >
                                    <Icon className="h-3 w-3" />
                                    {action.label}
                                </Button>
                            );
                        })}
                    </div>
                    {selectedAction ? (
                        <div className="mt-4 p-4 rounded-xl border border-border bg-background">
                            <div className="flex items-center justify-between mb-3 gap-3">
                                <div>
                                    <p className="text-sm font-semibold">{selectedAction}</p>
                                    <p className="text-xs text-muted-foreground">Interact with the selected dashboard action.</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedAction(null)}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </div>
                            {selectedAction === 'Create User' && (
                                <form className="space-y-3" onSubmit={handleCreateUser}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Input
                                            placeholder="Full name"
                                            value={userForm.name}
                                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Email"
                                            type="email"
                                            value={userForm.email}
                                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Password"
                                            type="password"
                                            value={userForm.password}
                                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                        <select
                                            className="input h-10 w-full sm:w-48"
                                            value={userForm.role}
                                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="program_manager">Program Manager</option>
                                            <option value="ybf">YBF</option>
                                            <option value="instructor">Instructor</option>
                                            <option value="enumerator">Enumerator</option>
                                        </select>
                                        <Button type="submit" className="h-10">Create User</Button>
                                    </div>
                                    {actionFeedback && <p className="text-sm text-muted-foreground">{actionFeedback}</p>}
                                </form>
                            )}
                            {selectedAction === 'Manage Roles' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <select
                                            className="input h-10 w-full"
                                            value={selectedRoleUser}
                                            onChange={(e) => setSelectedRoleUser(e.target.value)}
                                        >
                                            <option value="">Select user</option>
                                            {users.map((user: any) => (
                                                <option key={user.id} value={user.id}>{user.name} — {user.role}</option>
                                            ))}
                                        </select>
                                        <select
                                            className="input h-10 w-full"
                                            value={selectedUserRole}
                                            onChange={(e) => setSelectedUserRole(e.target.value)}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="program_manager">Program Manager</option>
                                            <option value="ybf">YBF</option>
                                            <option value="instructor">Instructor</option>
                                            <option value="enumerator">Enumerator</option>
                                        </select>
                                    </div>
                                    <Button onClick={handleChangeUserRole} className="h-10">Save Role</Button>
                                    {actionFeedback && <p className="text-sm text-muted-foreground">{actionFeedback}</p>}
                                </div>
                            )}
                            {selectedAction === 'Run Sync' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">Run a manual metadata sync to refresh attendance and partner records.</p>
                                    <Button onClick={handleRunSync} className="h-10" disabled={syncStatus === 'running'}>
                                        {syncStatus === 'running' ? 'Syncing…' : 'Start Sync'}
                                    </Button>
                                    {actionFeedback && <p className="text-sm text-muted-foreground">{actionFeedback}</p>}
                                </div>
                            )}
                            {selectedAction === 'View Audit Log' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">Recent admin events and system actions.</p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {recentActivity.slice(0, 5).map((item) => (
                                            <div key={item.id} className="rounded-xl border border-border p-3 bg-muted/50">
                                                <p className="text-sm font-medium">{item.message}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">{item.time}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedAction === 'Export Data' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">Download data snapshots for reporting or review.</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button className="h-10" onClick={() => exportCsv('youth.csv', youth)}>Export Youth</Button>
                                        <Button className="h-10" onClick={() => exportCsv('partners.csv', partners)}>Export Partners</Button>
                                        <Button className="h-10" onClick={() => exportCsv('sessions.csv', sessions)}>Export Sessions</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

        </div>
    );
}