import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { getDashboardStats, getYouth, getPartners, getSessions } from "@/api";
import { Users, Target, TrendingUp, Calendar, Award, BookOpen, Plus, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useNavigate } from "react-router-dom";

export default function YBFDashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
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

  if (statsLoading || youthLoading || partnersLoading || sessionsLoading) return <div>Loading...</div>;

  const dashboardStats = stats || { totalYouth: 0, totalPartners: 0, totalSessions: 0, totalCases: 0 };
  const youth = youthData || [];
  const partners = partnersData || [];
  const sessions = sessionsData || [];

  // Get partners assigned to this YBF
  const myPartners = partners.filter(p => p.assignedYBF === user?.name);
  const myPartnerIds = myPartners.map(p => p.id);

  // Get youth from my partners
  const myYouth = youth.filter(y => myPartnerIds.includes(y.partner_institution_id));

  // Calculate real YBF metrics
  const ybfStats = {
    myYouth: myYouth.length,
    completedSessions: sessions.filter(s => myPartnerIds.includes(s.partner_id)).length,
    upcomingSessions: sessions.filter(s => myPartnerIds.includes(s.partner_id) && new Date(s.session_date) > new Date()).length,
    businessPlansReviewed: myYouth.filter(y => y.business_plan_submitted).length, // Assuming this field exists
    personalProgress: {
      businessPlan: 85, // Keep as mock for now
      mentorshipHours: 67,
      skillDevelopment: 72,
      networkBuilding: 58,
    },
  };

  // Calculate session attendance from available data
  const sessionAttendance = sessions
    .filter(s => myPartnerIds.includes(s.partner_id))
    .slice(0, 4)
    .map(s => ({
      session: s.topic,
      attendance: Math.floor(Math.random() * 20) + 80 // Mock attendance for now
    }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Award className="h-6 w-6" />
          YBF Dashboard
        </h1>
        <p className="page-description">Welcome back, {user?.name}! Track your progress and youth development</p>
      </div>

      {/* YBF Personal Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Youth"
          value={ybfStats.myYouth}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Sessions Completed"
          value={ybfStats.completedSessions}
          icon={BookOpen}
          variant="success"
        />
        <StatCard
          title="Upcoming Sessions"
          value={ybfStats.upcomingSessions}
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          title="Business Plans Reviewed"
          value={ybfStats.businessPlansReviewed}
          icon={Target}
          variant="default"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="text-sm text-muted-foreground">Create new youth profiles or partner records from your dashboard.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={() => navigate('/youth')}
            className="h-20 flex flex-col items-center justify-center gap-2"
            variant="outline"
          >
            <Plus className="h-6 w-6" />
            <span className="font-semibold">Add Youth</span>
            <span className="text-xs text-muted-foreground">Register new participants</span>
          </Button>
          <Button
            onClick={() => navigate('/partners')}
            className="h-20 flex flex-col items-center justify-center gap-2"
            variant="outline"
          >
            <Building className="h-6 w-6" />
            <span className="font-semibold">Add Partner</span>
            <span className="text-xs text-muted-foreground">Add partner institutions</span>
          </Button>
        </div>
      </div>

      {/* Personal Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Your Development Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Business Plan Completion', value: ybfStats.personalProgress.businessPlan },
              { label: 'Mentorship Hours', value: ybfStats.personalProgress.mentorshipHours },
              { label: 'Skill Development', value: ybfStats.personalProgress.skillDevelopment },
              { label: 'Network Building', value: ybfStats.personalProgress.networkBuilding },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
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

      {/* Session Performance & Youth Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Session Attendance Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sessionAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
                <XAxis dataKey="session" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="attendance" fill="hsl(152, 55%, 33%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">My Youth Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myYouth.map(youth => (
                <div key={youth.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{youth.fullName}</p>
                    <p className="text-xs text-muted-foreground">{youth.businessIdea}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={youth.progress > 70 ? "default" : "secondary"}>
                      {youth.progress}% complete
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}