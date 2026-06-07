import { youth as initialYouth } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, AlertTriangle, Briefcase } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createYouth } from "@/api";
import { useUser } from "@/hooks/use-user";

function MilestoneIndicator({ status }: { status: string }) {
  const colors = { 'Completed': 'bg-success', 'In Progress': 'bg-warning', 'Not Started': 'bg-muted' };
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status as keyof typeof colors] || 'bg-muted'}`} title={status} />
  );
}

function YouthDetailDialog({ y }: { y: typeof initialYouth[0] }) {
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
  const { isProgramManager, isYBF, user } = useUser();
  const [filter, setFilter] = useState<'all' | 'at-risk'>('all');
  const [youthList, setYouthList] = useState(initialYouth);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    gender: 'Female',
    partner: '',
    programType: 'In-School',
    cohort: 'Cohort 2024-1',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    dateOfBirth: '',
    district: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const MAX = { name: 100, cohort: 60, partner: 150 };

  const validateYouthForm = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName || !form.fullName.trim()) errs.fullName = 'Full name is required';
    if (form.fullName && form.fullName.length > MAX.name) errs.fullName = `Full name must be ≤ ${MAX.name} chars`;
    if (!form.partner || !form.partner.trim()) errs.partner = 'Partner is required';
    if (form.partner && form.partner.length > MAX.partner) errs.partner = `Partner must be ≤ ${MAX.partner} chars`;
    if (!form.cohort || !form.cohort.trim()) errs.cohort = 'Cohort is required';
    if (form.cohort && form.cohort.length > MAX.cohort) errs.cohort = `Cohort must be ≤ ${MAX.cohort} chars`;
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    if (!form.district || !form.district.trim()) errs.district = 'District is required';
    return errs;
  };

  const formValid = Object.keys(validateYouthForm()).length === 0;

  const canEnroll = isProgramManager() || isYBF();

  const filtered = youthList.filter(y => filter === 'at-risk' ? y.riskFlag : true);

  const atRisk = youthList.filter(y => y.riskFlag).length;
  const inWork = youthList.filter(y => !y.employmentStatus.includes('Unemployed')).length;

  const handleEnroll = () => {
    const errs = validateYouthForm();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    (async () => {
      try {
        const payload: any = {
          full_name: form.fullName,
          date_of_birth: form.dateOfBirth,
          gender: form.gender,
          district: form.district,
        };
        const created = await createYouth(payload);
        const newYouth = {
          id: created.id,
          fullName: created.full_name || created.fullName || form.fullName,
          dob: created.date_of_birth || form.dateOfBirth,
          gender: created.gender || form.gender,
          nationality: created.nationality || 'Kenyan',
          region: created.region || 'Nairobi',
          district: created.district || form.district,
          partner: created.partner_name || form.partner,
          programType: created.program_type || form.programType,
          cohort: created.cohort || form.cohort,
          enrollmentDate: created.enrolment_date || form.enrollmentDate,
          employmentStatus: created.employment_status || 'Unemployed',
          baselineIncome: created.baseline_income || 0,
          currentIncome: created.current_income || 0,
          aboveIPL: created.above_ipl || false,
          educationLevel: created.education_level || 'Secondary',
          hasBusiness: created.has_business || false,
          businessPlan: 'Not Started',
          cv: 'Not Started',
          applicationLetter: 'Not Started',
          attendanceRate: 0,
          mentorshipStatus: 'Active',
          riskFlag: false,
        };
        setYouthList([newYouth, ...youthList]);
        setAddOpen(false);
        setForm({
          fullName: '',
          gender: 'Female',
          partner: '',
          programType: 'In-School',
          cohort: 'Cohort 2024-1',
          enrollmentDate: new Date().toISOString().slice(0, 10),
          dateOfBirth: '',
          district: '',
        });
      } catch (err: any) {
        setFieldErrors({ ...fieldErrors, fullName: err?.message || 'Failed to create youth' });
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Youth Enrollment & Profiling</h1>
          <p className="page-description">Manage youth registration and baseline data</p>
        </div>
        {canEnroll && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Enroll Youth</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Enroll New Youth</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="youth-name">Full Name</Label>
                  <Input
                    id="youth-name"
                    value={form.fullName}
                    onChange={e => { setForm({ ...form, fullName: e.target.value }); setFieldErrors({ ...fieldErrors, fullName: '' }); }}
                    placeholder="Alice Wanjiru"
                  />
                  {fieldErrors.fullName && <p className="text-sm text-destructive mt-1">{fieldErrors.fullName}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youth-dob">Date of Birth</Label>
                    <Input id="youth-dob" type="date" value={form.dateOfBirth} onChange={e => { setForm({ ...form, dateOfBirth: e.target.value }); setFieldErrors({ ...fieldErrors, dateOfBirth: '' }); }} />
                    {fieldErrors.dateOfBirth && <p className="text-sm text-destructive mt-1">{fieldErrors.dateOfBirth}</p>}
                  </div>
                  <div>
                    <Label htmlFor="youth-district">District</Label>
                    <Input id="youth-district" value={form.district} onChange={e => { setForm({ ...form, district: e.target.value }); setFieldErrors({ ...fieldErrors, district: '' }); }} placeholder="Nairobi" />
                    {fieldErrors.district && <p className="text-sm text-destructive mt-1">{fieldErrors.district}</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youth-gender">Gender</Label>
                    <select
                      id="youth-gender"
                      value={form.gender}
                      onChange={e => setForm({ ...form, gender: e.target.value as 'Male' | 'Female' })}
                      className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="youth-partner">Partner Institution</Label>
                    <Input
                      id="youth-partner"
                      value={form.partner}
                      onChange={e => { setForm({ ...form, partner: e.target.value }); setFieldErrors({ ...fieldErrors, partner: '' }); }}
                      placeholder="Nairobi Technical Institute"
                    />
                    {fieldErrors.partner && <p className="text-sm text-destructive mt-1">{fieldErrors.partner}</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youth-program">Program Type</Label>
                    <select
                      id="youth-program"
                      value={form.programType}
                      onChange={e => setForm({ ...form, programType: e.target.value as 'In-School' | 'Out-of-School' })}
                      className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="In-School">In-School</option>
                      <option value="Out-of-School">Out-of-School</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="youth-cohort">Cohort</Label>
                    <Input
                      id="youth-cohort"
                      value={form.cohort}
                      onChange={e => { setForm({ ...form, cohort: e.target.value }); setFieldErrors({ ...fieldErrors, cohort: '' }); }}
                      placeholder="Cohort 2024-1"
                    />
                    {fieldErrors.cohort && <p className="text-sm text-destructive mt-1">{fieldErrors.cohort}</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youth-enroll-date">Enrollment Date</Label>
                    <Input
                      id="youth-enroll-date"
                      type="date"
                      value={form.enrollmentDate}
                      onChange={e => setForm({ ...form, enrollmentDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setAddOpen(false); setFieldErrors({}); }}>Cancel</Button>
                  <Button onClick={() => {
                    const errs = validateYouthForm();
                    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
                    handleEnroll();
                  }} disabled={!formValid}>Enroll Youth</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Youth" value={youthList.length} icon={Users} variant="primary" />
        <StatCard title="At Risk (<80%)" value={atRisk} icon={AlertTriangle} variant="warning" />
        <StatCard title="In Work" value={inWork} subtitle={`${Math.round(inWork / Math.max(youthList.length, 1))}% of total`} icon={Briefcase} variant="success" />
      </div>

      <div className="flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
        <Button variant={filter === 'at-risk' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('at-risk')}>At Risk</Button>
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
