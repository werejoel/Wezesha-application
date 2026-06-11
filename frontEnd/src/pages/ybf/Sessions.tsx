import { useEffect, useMemo, useState } from "react";
import {
  getSessions,
  getYouth,
  getAttendance,
  getCohorts,
  createSession,
  createBulkAttendance,
} from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FormActions,
  FormDialogShell,
  FormFieldError,
  FormSection,
  formSelectClass,
} from "@/components/FormDialogShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Plus,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";
import {
  ATTENDANCE_STATUSES,
  normalizeSessionRow,
  normalizeYouthRow,
  type AttendanceStatus,
} from "./utils";

type AttendanceMap = Record<string, AttendanceStatus>;

const SESSION_TERMS = ["Term 1", "Term 2"] as const;

const defaultSessionForm = () => ({
  cohortId: "",
  topic: "",
  session_date: new Date().toISOString().slice(0, 10),
  venue: "",
  term: "Term 1" as (typeof SESSION_TERMS)[number],
  sessionNumber: 1,
});

export default function YBFSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<
    ReturnType<typeof normalizeSessionRow>[]
  >([]);
  const [youthList, setYouthList] = useState<
    ReturnType<typeof normalizeYouthRow>[]
  >([]);
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [termFilter, setTermFilter] = useState("all");
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<
    ReturnType<typeof normalizeSessionRow> | null
  >(null);
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceMap>({});
  const [addOpen, setAddOpen] = useState(false);
  const [cohorts, setCohorts] = useState<
    { id: string; label: string }[]
  >([]);
  const [sessionForm, setSessionForm] = useState(defaultSessionForm);
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>(
    {},
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getSessions(), getYouth(), getAttendance(), getCohorts()])
      .then(([sessionRows, youthRows, attRows, cohortRows]) => {
        if (!mounted) return;
        setSessions(
          Array.isArray(sessionRows)
            ? sessionRows.map(normalizeSessionRow)
            : [],
        );
        setYouthList(
          Array.isArray(youthRows) ? youthRows.map(normalizeYouthRow) : [],
        );
        setAttendanceRows(Array.isArray(attRows) ? attRows : []);
        const cohortOptions = Array.isArray(cohortRows)
          ? cohortRows.map((c: any) => ({
              id: String(c.id),
              label:
                c.label ||
                (c.partner_name
                  ? `Cohort ${c.program_year} — ${c.partner_name}`
                  : `Cohort ${c.program_year}`),
            }))
          : [];
        setCohorts(cohortOptions);
        if (cohortOptions.length > 0) {
          setSessionForm((prev) => ({
            ...prev,
            cohortId: prev.cohortId || cohortOptions[0].id,
          }));
        }
      })
      .catch(() => {
        if (mounted) {
          setSessions([]);
          setYouthList([]);
          setAttendanceRows([]);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      sessions.filter(
        (s) => termFilter === "all" || s.term === termFilter,
      ),
    [sessions, termFilter],
  );

  const avgAttendance = sessions.length
    ? Math.round(
        sessions.reduce((s, ses) => s + ses.attendancePct, 0) / sessions.length,
      )
    : 0;

  const openAttendance = (session: ReturnType<typeof normalizeSessionRow>) => {
    const cohortYouth = youthList.filter((y) => y.cohortId === session.cohortId);
    const existing = attendanceRows.filter(
      (a) => String(a.session_id) === session.id,
    );
    const draft: AttendanceMap = {};
    for (const y of cohortYouth) {
      const record = existing.find((a) => String(a.youth_id) === y.id);
      draft[y.id] = (record?.status as AttendanceStatus) || "Present";
    }
    setSelectedSession(session);
    setAttendanceDraft(draft);
    setAttendanceOpen(true);
  };

  const cohortYouth = useMemo(() => {
    if (!selectedSession) return [];
    return youthList.filter((y) => y.cohortId === selectedSession.cohortId);
  }, [selectedSession, youthList]);

  const handleSaveAttendance = async () => {
    if (!selectedSession) return;
    setSaving(true);
    try {
      const records = Object.entries(attendanceDraft).map(
        ([youthId, status]) => ({
          session_id: selectedSession.id,
          youth_id: youthId,
          status,
        }),
      );
      await createBulkAttendance(records);

      const present = records.filter((r) => r.status === "Present").length;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSession.id
            ? {
                ...s,
                attendanceCount: present,
                totalYouth: records.length,
                attendancePct:
                  records.length > 0
                    ? Math.round((present / records.length) * 100)
                    : 0,
              }
            : s,
        ),
      );

      const refreshed = await getAttendance();
      setAttendanceRows(Array.isArray(refreshed) ? refreshed : []);

      setAttendanceOpen(false);
      setConfirmOpen(false);
      toast({
        title: "Attendance saved",
        description: `Marked attendance for ${records.length} youth in "${selectedSession.topic}".`,
      });
    } catch (err: any) {
      toast({
        title: "Could not save attendance",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!addOpen) {
      setSessionForm({
        ...defaultSessionForm(),
        cohortId: cohorts[0]?.id ?? "",
      });
      setSessionErrors({});
      return;
    }
    if (cohorts.length > 0) {
      setSessionForm((prev) => ({
        ...prev,
        cohortId: prev.cohortId || cohorts[0].id,
      }));
    }
  }, [addOpen, cohorts]);

  const validateSessionForm = () => {
    const errs: Record<string, string> = {};
    if (!sessionForm.cohortId) errs.cohortId = "Select a cohort";
    if (!sessionForm.topic.trim()) errs.topic = "Topic is required";
    if (!sessionForm.session_date) errs.session_date = "Date is required";
    if (!sessionForm.sessionNumber || sessionForm.sessionNumber <= 0)
      errs.sessionNumber = "Session number must be greater than 0";
    return errs;
  };

  const sessionFormValid = Object.keys(validateSessionForm()).length === 0;

  const handleCreateSession = async () => {
    const errs = validateSessionForm();
    if (Object.keys(errs).length > 0) {
      setSessionErrors(errs);
      return;
    }
    setCreating(true);
    try {
      await createSession({
        cohort_id: sessionForm.cohortId,
        topic: sessionForm.topic.trim(),
        session_date: sessionForm.session_date,
        venue: sessionForm.venue || "",
        term_number: sessionForm.term === "Term 1" ? 1 : 2,
        session_number: Number(sessionForm.sessionNumber) || 1,
      });
      const refreshed = await getSessions();
      setSessions(
        Array.isArray(refreshed) ? refreshed.map(normalizeSessionRow) : [],
      );
      const cohortLabel =
        cohorts.find((c) => c.id === sessionForm.cohortId)?.label ?? "";
      setAddOpen(false);
      toast({
        title: "Session scheduled",
        description: `"${sessionForm.topic}" added for ${cohortLabel}.`,
      });
    } catch (err: any) {
      const message = err?.message || "Failed to create session";
      setSessionErrors({ submit: message });
      toast({
        title: "Could not create session",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    const next: AttendanceMap = {};
    for (const y of cohortYouth) next[y.id] = status;
    setAttendanceDraft(next);
    toast({
      title: `All marked ${status}`,
      description: `${cohortYouth.length} youth updated. Review and save when ready.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Session Schedule</h1>
          <p className="page-description">
            Schedule sessions for your cohorts and mark attendance — bulk or
            individual.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> Add Session
            </Button>
          </DialogTrigger>
          <FormDialogShell
            theme="session"
            icon={CalendarCheck}
            title="Schedule New Session"
            subtitle="Plan a session for one of your assigned cohorts"
          >
            <div className="space-y-4">
              <FormSection theme="session" title="Session details">
                <div>
                  <Label htmlFor="ybf-session-cohort">Cohort</Label>
                  {cohorts.length > 0 ? (
                    <Select
                      value={sessionForm.cohortId || undefined}
                      onValueChange={(v) => {
                        setSessionForm({ ...sessionForm, cohortId: v });
                        setSessionErrors((p) => ({ ...p, cohortId: "" }));
                      }}
                    >
                      <SelectTrigger
                        id="ybf-session-cohort"
                        className="bg-white/80"
                      >
                        <SelectValue placeholder="Select cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-3">
                      No cohorts assigned. Add a partner institution first.
                    </p>
                  )}
                  <FormFieldError message={sessionErrors.cohortId} />
                </div>
                <div>
                  <Label htmlFor="ybf-session-topic">Topic</Label>
                  <Input
                    id="ybf-session-topic"
                    value={sessionForm.topic}
                    onChange={(e) => {
                      setSessionForm({
                        ...sessionForm,
                        topic: e.target.value,
                      });
                      setSessionErrors((p) => ({ ...p, topic: "" }));
                    }}
                    placeholder="Business planning workshop"
                    className="bg-white/80"
                  />
                  <FormFieldError message={sessionErrors.topic} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ybf-session-date">Date</Label>
                    <Input
                      id="ybf-session-date"
                      type="date"
                      value={sessionForm.session_date}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          session_date: e.target.value,
                        })
                      }
                      className="bg-white/80"
                    />
                    <FormFieldError message={sessionErrors.session_date} />
                  </div>
                  <div>
                    <Label htmlFor="ybf-session-number">Session #</Label>
                    <Input
                      id="ybf-session-number"
                      type="number"
                      min={1}
                      value={String(sessionForm.sessionNumber)}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          sessionNumber: Number(e.target.value),
                        })
                      }
                      className="bg-white/80"
                    />
                    <FormFieldError message={sessionErrors.sessionNumber} />
                  </div>
                </div>
              </FormSection>

              <FormSection theme="session" title="Logistics">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ybf-session-term">Term</Label>
                    <select
                      id="ybf-session-term"
                      value={sessionForm.term}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          term: e.target.value as (typeof SESSION_TERMS)[number],
                        })
                      }
                      className={formSelectClass}
                    >
                      {SESSION_TERMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="ybf-session-venue">Venue</Label>
                    <Input
                      id="ybf-session-venue"
                      value={sessionForm.venue}
                      onChange={(e) =>
                        setSessionForm({ ...sessionForm, venue: e.target.value })
                      }
                      placeholder="Main hall"
                      className="bg-white/80"
                    />
                  </div>
                </div>
              </FormSection>

              <FormFieldError message={sessionErrors.submit} />
              <FormActions
                theme="session"
                onCancel={() => setAddOpen(false)}
                onSubmit={handleCreateSession}
                submitLabel={creating ? "Scheduling…" : "Schedule Session"}
                disabled={!sessionFormValid || creating || cohorts.length === 0}
              />
            </div>
          </FormDialogShell>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Scheduled Sessions"
          value={sessions.length}
          icon={CalendarCheck}
          variant="primary"
        />
        <StatCard
          title="Avg Attendance"
          value={`${avgAttendance}%`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="This Term"
          value={sessions.filter((s) => s.term === "Term 1").length}
          subtitle="Term 1 sessions"
          icon={CalendarCheck}
        />
      </div>

      <div className="flex gap-2">
        {["all", "Term 1", "Term 2"].map((t) => (
          <Button
            key={t}
            variant={termFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTermFilter(t)}
          >
            {t === "all" ? "All Terms" : t}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading sessions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No sessions scheduled</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sessions for your cohorts will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">
                      {s.date}
                    </TableCell>
                    <TableCell className="font-medium">
                      #{s.sessionNumber}
                    </TableCell>
                    <TableCell>{s.topic}</TableCell>
                    <TableCell>{s.partner}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.term}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {s.attendanceCount}/{s.totalYouth}
                      </span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({s.attendancePct}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAttendance(s)}
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Mark Attendance
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Entry</DialogTitle>
            {selectedSession && (
              <p className="text-sm text-muted-foreground">
                {selectedSession.topic} · {selectedSession.date} ·{" "}
                {selectedSession.partner}
              </p>
            )}
          </DialogHeader>

          <div className="flex flex-wrap gap-2 pb-2 border-b">
            <Button size="sm" variant="secondary" onClick={() => markAll("Present")}>
              Mark all Present
            </Button>
            <Button size="sm" variant="outline" onClick={() => markAll("Absent")}>
              Mark all Absent
            </Button>
          </div>

          <div className="space-y-3 py-2">
            {cohortYouth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No youth found in this session&apos;s cohort.
              </p>
            ) : (
              cohortYouth.map((y) => (
                <div
                  key={y.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{y.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {y.attendanceRate}% overall attendance
                    </p>
                  </div>
                  <Select
                    value={attendanceDraft[y.id] || "Present"}
                    onValueChange={(v) =>
                      setAttendanceDraft((prev) => ({
                        ...prev,
                        [y.id]: v as AttendanceStatus,
                      }))
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAttendanceOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={cohortYouth.length === 0 || saving}
              onClick={() => setConfirmOpen(true)}
            >
              Save Attendance
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to save attendance for {cohortYouth.length} youth in
              &ldquo;{selectedSession?.topic}&rdquo;. This will update existing
              records if any.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAttendance} disabled={saving}>
              {saving ? "Saving…" : "Yes, save attendance"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
