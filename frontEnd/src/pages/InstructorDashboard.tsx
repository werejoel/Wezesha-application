import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { getDashboardStats, getSessions, getYouth, getPartners } from "@/api";
import { GraduationCap, Users, Calendar, BookOpen, Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";

export default function InstructorDashboard() {
  const { user } = useUser();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
  });

  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: getPartners,
  });

  const { data: youthData, isLoading: youthLoading } = useQuery({
    queryKey: ['youth'],
    queryFn: getYouth,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });

  if (statsLoading || sessionsLoading || partnersLoading || youthLoading) return <div>Loading...</div>;

  const dashboardStats = stats || { totalYouth: 0, totalPartners: 0, totalSessions: 0, totalCases: 0 };
  const sessions = sessionsData || [];
  const partners = partnersData || [];

  // Get partners assigned to this instructor
  const myPartners = partners.filter(p => p.assigned_instructor === user?.name || p.role === 'Instructor');
  const myPartnerIds = myPartners.map(p => p.id);

  // Calculate real instructor metrics
  const instructorStats = {
    sessionsTaught: sessions.length, // For now, show all sessions since no instructor field
    totalStudents: youthData?.length || 0,
    avgRating: 4.7, // Keep mock
    upcomingSessions: sessions.filter(s => new Date(s.session_date) > new Date()).length,
    curriculumCompletion: 78, // Keep mock
  };

  // Use real session topics for engagement data
  const studentEngagement = sessions.slice(0, 4).map(s => ({
    topic: s.topic,
    engagement: Math.floor(Math.random() * 15) + 80 // Mock engagement
  }));

  const mySessions = sessions.filter(s => new Date(s.session_date) > new Date()).slice(0, 3);

  const teachingMetrics = [
    { metric: 'Student Satisfaction', value: 94, target: 90 },
    { metric: 'Curriculum Delivery', value: 87, target: 85 },
    { metric: 'Skill Assessment', value: 91, target: 88 },
    { metric: 'Practical Application', value: 83, target: 80 },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          Instructor Dashboard
        </h1>
        <p className="page-description">Welcome back, {user?.name}! Monitor your teaching impact and student progress</p>
      </div>

      {/* Instructor Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sessions Taught"
          value={instructorStats.sessionsTaught}
          icon={BookOpen}
          variant="primary"
        />
        <StatCard
          title="Total Students"
          value={instructorStats.totalStudents}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Average Rating"
          value={`${instructorStats.avgRating}/5`}
          icon={Award}
          variant="warning"
        />
        <StatCard
          title="Upcoming Sessions"
          value={instructorStats.upcomingSessions}
          icon={Calendar}
          variant="default"
        />
      </div>

      {/* Teaching Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Teaching Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teachingMetrics.map(item => (
              <div key={item.metric}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{item.metric}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.value}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Target: {item.target}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Student Engagement & Upcoming Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Student Engagement by Topic</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={studentEngagement}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                <XAxis dataKey="topic" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="engagement" fill="hsl(38, 90%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">My Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mySessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.partner} • {new Date(session.date).toLocaleDateString()} • {session.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{session.enrolled} enrolled</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Curriculum Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Curriculum Completion Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Overall Completion</span>
            <span className="font-semibold">{instructorStats.curriculumCompletion}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${instructorStats.curriculumCompletion}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">12</p>
              <p className="text-xs text-muted-foreground">Modules Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">2</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">94%</p>
              <p className="text-xs text-muted-foreground">Avg. Score</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}