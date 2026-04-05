import { sessions } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, Plus, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";

export default function Sessions() {
  const { isProgramManager, isYBF } = useUser();
  const [termFilter, setTermFilter] = useState<string>('all');
  const filtered = sessions.filter(s => termFilter === 'all' || s.term === termFilter);
  const avgAttendance = Math.round(sessions.reduce((s, ses) => s + (ses.attendanceCount / ses.totalYouth * 100), 0) / sessions.length);

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Session & Attendance</h1>
          <p className="page-description">Plan sessions and track attendance across cohorts</p>
        </div>
        {(isProgramManager() || isYBF()) && (
          <Button><Plus className="h-4 w-4 mr-1" /> New Session</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Sessions" value={sessions.length} icon={CalendarCheck} variant="primary" />
        <StatCard title="Avg Attendance" value={`${avgAttendance}%`} icon={CheckCircle2} variant="success" />
        <StatCard title="Sessions This Term" value={sessions.filter(s => s.term === 'Term 1').length} subtitle="Term 1" icon={CalendarCheck} />
      </div>

      <div className="flex gap-2">
        {['all', 'Term 1', 'Term 2', 'Term 3'].map(t => (
          <Button key={t} variant={termFilter === t ? 'default' : 'outline'} size="sm" onClick={() => setTermFilter(t)}>
            {t === 'all' ? 'All Terms' : t}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Facilitator</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/50">
                  <TableCell className="text-muted-foreground">{s.date}</TableCell>
                  <TableCell className="font-medium">#{s.sessionNumber}</TableCell>
                  <TableCell>{s.topic}</TableCell>
                  <TableCell>{s.partner}</TableCell>
                  <TableCell>{s.facilitator}</TableCell>
                  <TableCell><Badge variant="secondary">{s.term}</Badge></TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">{s.attendanceCount}/{s.totalYouth}</span>
                    <span className="text-muted-foreground ml-1 text-xs">({Math.round(s.attendanceCount / s.totalYouth * 100)}%)</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
