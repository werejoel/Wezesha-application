import { sessions as initialSessions } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, Plus, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { createSession } from "@/api";
import { useUser } from "@/hooks/use-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MAX = { topic: 200, facilitator: 100, venue: 150 };


export default function Sessions() {
  const { isProgramManager, isYBF } = useUser();
  const [termFilter, setTermFilter] = useState<string>('all');
  const [sessionsList, setSessionsList] = useState(initialSessions);
  const filtered = sessionsList.filter(s => termFilter === 'all' || s.term === termFilter);
  const avgAttendance = Math.round(sessionsList.reduce((s, ses) => s + (ses.attendanceCount / Math.max(ses.totalYouth,1) * 100), 0) / Math.max(sessionsList.length, 1));
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ cohort: '', cohortId: '', topic: '', session_date: new Date().toISOString().slice(0,10), facilitator: '', venue: '', term: 'Term 1', sessionNumber: 1 });
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  const validateSessionForm = () => {
    const errs: Record<string,string> = {};
    if (!form.cohort || !form.cohort.trim()) errs.cohort = 'Cohort is required';
    if (!form.topic || !form.topic.trim()) errs.topic = 'Topic is required';
    if (form.topic && form.topic.length > MAX.topic) errs.topic = `Topic must be ≤ ${MAX.topic} chars`;
    if (!form.session_date) errs.session_date = 'Session date is required';
    if (form.facilitator && form.facilitator.length > MAX.facilitator) errs.facilitator = `Facilitator must be ≤ ${MAX.facilitator} chars`;
    if (form.venue && form.venue.length > MAX.venue) errs.venue = `Venue must be ≤ ${MAX.venue} chars`;
    if (!form.sessionNumber || Number(form.sessionNumber) <= 0) errs.sessionNumber = 'Session number must be > 0';
    return errs;
  };

  const formValid = Object.keys(validateSessionForm()).length === 0;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Session & Attendance</h1>
          <p className="page-description">Plan sessions and track attendance across cohorts</p>
        </div>
        {(isProgramManager() || isYBF()) && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> New Session</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Session</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="session-cohort">Cohort (name)</Label>
                  <Input id="session-cohort" value={form.cohort} onChange={e => { setForm({ ...form, cohort: e.target.value }); setFieldErrors({ ...fieldErrors, cohort: '' }); }} placeholder="Cohort 2024-1" />
                  <p className="text-xs text-muted-foreground mt-1">You may also provide a numeric cohort id to persist to backend.</p>
                  {fieldErrors.cohort && <p className="text-sm text-destructive mt-1">{fieldErrors.cohort}</p>}
                </div>
                <div>
                  <Label htmlFor="session-cohort-id">Cohort ID (optional)</Label>
                  <Input id="session-cohort-id" value={form.cohortId} onChange={e => { setForm({ ...form, cohortId: e.target.value }); setFieldErrors({ ...fieldErrors, cohortId: '' }); }} placeholder="e.g. 12" />
                  {fieldErrors.cohortId && <p className="text-sm text-destructive mt-1">{fieldErrors.cohortId}</p>}
                </div>
                <div>
                  <Label htmlFor="session-topic">Topic</Label>
                  <Input id="session-topic" value={form.topic} onChange={e => { setForm({ ...form, topic: e.target.value }); setFieldErrors({ ...fieldErrors, topic: '' }); }} placeholder="Session topic" />
                  {fieldErrors.topic && <p className="text-sm text-destructive mt-1">{fieldErrors.topic}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="session-date">Date</Label>
                    <Input id="session-date" type="date" value={form.session_date} onChange={e => { setForm({ ...form, session_date: e.target.value }); setFieldErrors({ ...fieldErrors, session_date: '' }); }} />
                    {fieldErrors.session_date && <p className="text-sm text-destructive mt-1">{fieldErrors.session_date}</p>}
                  </div>
                  <div>
                    <Label htmlFor="session-number">Session #</Label>
                    <Input id="session-number" type="number" min={1} value={String(form.sessionNumber)} onChange={e => { setForm({ ...form, sessionNumber: Number(e.target.value) }); setFieldErrors({ ...fieldErrors, sessionNumber: '' }); }} />
                    {fieldErrors.sessionNumber && <p className="text-sm text-destructive mt-1">{fieldErrors.sessionNumber}</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="session-facilitator">Facilitator</Label>
                    <Input id="session-facilitator" value={form.facilitator} onChange={e => { setForm({ ...form, facilitator: e.target.value }); setFieldErrors({ ...fieldErrors, facilitator: '' }); }} />
                    {fieldErrors.facilitator && <p className="text-sm text-destructive mt-1">{fieldErrors.facilitator}</p>}
                  </div>
                  <div>
                    <Label htmlFor="session-venue">Venue</Label>
                    <Input id="session-venue" value={form.venue} onChange={e => { setForm({ ...form, venue: e.target.value }); setFieldErrors({ ...fieldErrors, venue: '' }); }} />
                    {fieldErrors.venue && <p className="text-sm text-destructive mt-1">{fieldErrors.venue}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setNewOpen(false); setFieldErrors({}); }}>Cancel</Button>
                  <Button onClick={async () => {
                    const errs = validateSessionForm();
                    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
                    if (form.cohortId && /^\\d+$/.test(String(form.cohortId))) {
                      try {
                        const payload: any = {
                          cohort_id: Number(form.cohortId),
                          topic: form.topic,
                          session_date: form.session_date,
                          venue: form.venue,
                          term_number: form.term === 'Term 1' ? 1 : form.term === 'Term 2' ? 2 : 3,
                          session_number: Number(form.sessionNumber),
                          facilitator: form.facilitator,
                        };
                        const created = await createSession(payload);
                        const newSession = {
                          id: created.id,
                          cohort: form.cohort,
                          partner: created.partner_name || form.partner || 'Unknown',
                          term: form.term,
                          sessionNumber: created.session_number || Number(form.sessionNumber),
                          topic: created.topic || form.topic,
                          facilitator: created.facilitator || form.facilitator,
                          date: created.session_date || form.session_date,
                          time: created.time || '',
                          venue: created.venue || form.venue,
                          attendanceCount: created.attendance_count || 0,
                          totalYouth: created.total || 0,
                        };
                        setSessionsList([newSession, ...sessionsList]);
                        setNewOpen(false);
                        setForm({ cohort: '', cohortId: '', topic: '', session_date: new Date().toISOString().slice(0,10), facilitator: '', venue: '', term: 'Term 1', sessionNumber: 1 });
                      } catch (err: any) {
                        console.error('create session error', err);
                        setFieldErrors({ ...fieldErrors, cohortId: err?.message || 'Failed to create session' });
                      }
                    } else {
                      const newSession = {
                        id: `S${String(sessionsList.length + 1).padStart(3,'0')}`,
                        cohort: form.cohort,
                        partner: form.partner || 'Unknown',
                        term: form.term as 'Term 1'|'Term 2'|'Term 3',
                        sessionNumber: Number(form.sessionNumber),
                        topic: form.topic,
                        facilitator: form.facilitator,
                        date: form.session_date,
                        time: '',
                        venue: form.venue,
                        attendanceCount: 0,
                        totalYouth: 0,
                      };
                      setSessionsList([newSession, ...sessionsList]);
                      setNewOpen(false);
                      setForm({ cohort: '', cohortId: '', topic: '', session_date: new Date().toISOString().slice(0,10), facilitator: '', venue: '', term: 'Term 1', sessionNumber: 1 });
                    }
                  }} disabled={!formValid}>Save Session</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Sessions" value={sessionsList.length} icon={CalendarCheck} variant="primary" />
        <StatCard title="Avg Attendance" value={`${avgAttendance}%`} icon={CheckCircle2} variant="success" />
        <StatCard title="Sessions This Term" value={sessionsList.filter(s => s.term === 'Term 1').length} subtitle="Term 1" icon={CalendarCheck} />
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
