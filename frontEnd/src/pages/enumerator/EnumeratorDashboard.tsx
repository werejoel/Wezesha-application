import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { getDashboardStats, getYouth, getSessions } from "@/api";
import { ClipboardList, MapPin, CheckCircle, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";

export default function EnumeratorDashboard() {
    const { user } = useUser();
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: getDashboardStats,
    });

    const { data: youthData, isLoading: youthLoading } = useQuery({
        queryKey: ['youth'],
        queryFn: getYouth,
    });

    const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
        queryKey: ['sessions'],
        queryFn: getSessions,
    });

    if (statsLoading || youthLoading || sessionsLoading) return <div>Loading...</div>;

    const dashboardStats = stats || { totalYouth: 0, totalPartners: 0, totalSessions: 0, totalCases: 0 };
    const youth = youthData || [];
    const sessions = sessionsData || [];

    // Calculate real enumerator metrics based on available data
    const enumeratorStats = {
        surveysCompleted: youth.length, // Assume each youth represents a survey/data collection
        pendingSurveys: Math.floor(youth.length * 0.15), // Estimate pending surveys
        dataQuality: 92, // Keep mock for now
        fieldVisits: sessions.length,
        avgResponseTime: '2.3 days',
    };

    // Calculate survey completion over time (using youth enrollment dates)
    const surveyCompletion = youth.reduce((acc, y) => {
        if (y.enrolment_date) {
            const date = new Date(y.enrolment_date);
            const weekNum = Math.ceil((date.getDate() - 1) / 7);
            const weekKey = `Week ${weekNum}`;
            const existing = acc.find(item => item.week === weekKey);
            if (existing) {
                existing.completed += 1;
            } else if (acc.length < 4) {
                acc.push({ week: weekKey, completed: 1 });
            }
        }
        return acc;
    }, [] as { week: string; completed: number }[]).slice(0, 4);

    // Calculate data quality based on youth data completeness
    const completeRecords = youth.filter(y => y.full_name && y.date_of_birth && y.gender).length;
    const incompleteRecords = youth.length - completeRecords;
    const dataQualityMetrics = [
        { name: 'Complete', value: completeRecords },
        { name: 'Incomplete', value: incompleteRecords },
        { name: 'Needs Review', value: Math.floor(youth.length * 0.05) },
    ];

    const recentActivities = [
        { type: 'Survey Completed', location: 'Nairobi CBD', time: '2 hours ago', status: 'success' },
        { type: 'Field Visit', location: 'Westlands', time: '5 hours ago', status: 'success' },
        { type: 'Data Sync', location: 'Online', time: '1 day ago', status: 'warning' },
        { type: 'Survey Pending', location: 'Karen', time: '2 days ago', status: 'pending' },
    ];

    const CHART_COLORS = ['hsl(152, 55%, 33%)', 'hsl(38, 90%, 55%)', 'hsl(0, 72%, 51%)'];

    return (
        <div className="space-y-6">
            <div className="page-header">
                <h1 className="page-title flex items-center gap-2">
                    <ClipboardList className="h-6 w-6" />
                    Enumerator Dashboard
                </h1>
                <p className="page-description">Welcome back, {user?.name}! Track your data collection progress and field activities</p>
            </div>

            {/* Enumerator Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Surveys Completed"
                    value={enumeratorStats.surveysCompleted}
                    icon={CheckCircle}
                    variant="primary"
                />
                <StatCard
                    title="Pending Surveys"
                    value={enumeratorStats.pendingSurveys}
                    icon={Clock}
                    variant="warning"
                />
                <StatCard
                    title="Data Quality Score"
                    value={`${enumeratorStats.dataQuality}%`}
                    icon={BarChart3}
                    variant="success"
                />
                <StatCard
                    title="Field Visits"
                    value={enumeratorStats.fieldVisits}
                    icon={MapPin}
                    variant="default"
                />
            </div>

            {/* Survey Progress & Data Quality */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">Weekly Survey Completion</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={surveyCompletion}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="completed" fill="hsl(152, 55%, 33%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">Data Quality Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={dataQualityMetrics} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {dataQualityMetrics.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activities */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-primary" /> Recent Field Activities
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {recentActivities.map((activity, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${activity.status === 'success' ? 'bg-green-500' :
                                        activity.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                        }`} />
                                    <div>
                                        <p className="text-sm font-medium">{activity.type}</p>
                                        <p className="text-xs text-muted-foreground">{activity.location} • {activity.time}</p>
                                    </div>
                                </div>
                                <Badge variant={
                                    activity.status === 'success' ? 'default' :
                                        activity.status === 'warning' ? 'secondary' : 'outline'
                                }>
                                    {activity.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading">Response Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{enumeratorStats.avgResponseTime}</p>
                            <p className="text-xs text-muted-foreground">Average survey completion</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading">Accuracy Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">96%</p>
                            <p className="text-xs text-muted-foreground">Data validation passed</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading">Coverage Area</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">12</p>
                            <p className="text-xs text-muted-foreground">Locations surveyed</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}