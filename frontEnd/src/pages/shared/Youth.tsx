import { youth } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, AlertTriangle, Briefcase } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUser } from "@/hooks/use-user";

function MilestoneIndicator({ status }: { status: string }) {
  const colors = { 'Completed': 'bg-success', 'In Progress': 'bg-warning', 'Not Started': 'bg-muted' };
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status as keyof typeof colors] || 'bg-muted'}`} title={status} />
  );
}

function YouthDetailDialog({ y }: { y: typeof youth[0] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">{y.fullName}</TableCell>
          <TableCell>{y.gender}</TableCell>
          <TableCell>{y.partner}</TableCell>
          <TableCell><Badge variant="secondary">{y.programType}</Badge></TableCell>
          <TableCell>
            <span className={y.attendanceRate < 80 ? 'text-destructive font-semibold' : 'text-foreground font-semibold'}>
              {y.attendanceRate}%
            </span>
          </TableCell>
          <TableCell>
            <div className="flex gap-1.5 items-center">
              <MilestoneIndicator status={y.businessPlan} />
              <MilestoneIndicator status={y.cv} />
              <MilestoneIndicator status={y.applicationLetter} />
            </div>
          </TableCell>
          <TableCell><Badge variant={y.employmentStatus.includes('Unemployed') ? 'destructive' : 'default'}>{y.employmentStatus}</Badge></TableCell>
          <TableCell>{y.riskFlag && <AlertTriangle className="h-4 w-4 text-destructive" />}</TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{y.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">ID:</span> {y.id}</div>
            <div><span className="text-muted-foreground">DOB:</span> {y.dob}</div>
            <div><span className="text-muted-foreground">Gender:</span> {y.gender}</div>
            <div><span className="text-muted-foreground">Region:</span> {y.region}</div>
            <div><span className="text-muted-foreground">Partner:</span> {y.partner}</div>
            <div><span className="text-muted-foreground">Cohort:</span> {y.cohort}</div>
            <div><span className="text-muted-foreground">Program:</span> {y.programType}</div>
            <div><span className="text-muted-foreground">Education:</span> {y.educationLevel}</div>
          </div>
          <div className="border-t pt-3">
            <h4 className="font-semibold mb-2 font-heading">Output Milestones</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted">
                <MilestoneIndicator status={y.businessPlan} />
                <p className="text-xs mt-1">Business Plan</p>
                <p className="text-xs text-muted-foreground">{y.businessPlan}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted">
                <MilestoneIndicator status={y.cv} />
                <p className="text-xs mt-1">CV</p>
                <p className="text-xs text-muted-foreground">{y.cv}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted">
                <MilestoneIndicator status={y.applicationLetter} />
                <p className="text-xs mt-1">Cover Letter</p>
                <p className="text-xs text-muted-foreground">{y.applicationLetter}</p>
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <h4 className="font-semibold mb-2 font-heading">Income & Employment</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Status:</span> {y.employmentStatus}</div>
              <div><span className="text-muted-foreground">Attendance:</span> {y.attendanceRate}%</div>
              <div><span className="text-muted-foreground">Baseline Income:</span> KES {y.baselineIncome.toLocaleString()}</div>
              <div><span className="text-muted-foreground">Current Income:</span> KES {y.currentIncome.toLocaleString()}</div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Above IPL:</span>{' '}
                <Badge variant={y.aboveIPL ? 'default' : 'destructive'}>{y.aboveIPL ? 'Yes' : 'No'}</Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Youth() {
  const { isProgramManager } = useUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'at-risk'>('all');

  const filtered = youth
    .filter(y => filter === 'at-risk' ? y.riskFlag : true)
    .filter(y => y.fullName.toLowerCase().includes(search.toLowerCase()) || y.partner.toLowerCase().includes(search.toLowerCase()));

  const atRisk = youth.filter(y => y.riskFlag).length;
  const inWork = youth.filter(y => !y.employmentStatus.includes('Unemployed')).length;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Youth Enrollment & Profiling</h1>
          <p className="page-description">Manage youth registration and baseline data</p>
        </div>
        {isProgramManager() && (
          <Button><Plus className="h-4 w-4 mr-1" /> Enroll Youth</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Youth" value={youth.length} icon={Users} variant="primary" />
        <StatCard title="At Risk (<80%)" value={atRisk} icon={AlertTriangle} variant="warning" />
        <StatCard title="In Work" value={inWork} subtitle={`${Math.round(inWork / youth.length * 100)}% of total`} icon={Briefcase} variant="success" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search youth by name or partner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 sm:max-w-xs px-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
          <Button variant={filter === 'at-risk' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('at-risk')}>At Risk</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Outputs</TableHead>
                <TableHead>Employment</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(y => <YouthDetailDialog key={y.id} y={y} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
