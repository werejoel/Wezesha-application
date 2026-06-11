import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, Plus, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useEffect, useState } from "react";
import { createSession, getCohorts, getSessions } from "@/api";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { normalizeSessionRow } from "@/pages/ybf/utils";
import {
  FormActions,
  FormDialogShell,
  FormFieldError,
  FormSection,
  formSelectClass,
} from "@/components/FormDialogShell";

const MAX = { topic: 200, venue: 150 };
const SESSION_TERMS = ["Term 1", "Term 2"] as const;

const defaultForm = () => ({
  cohortId: "",
  topic: "",
  session_date: new Date().toISOString().slice(0, 10),
  venue: "",
  term: "Term 1" as (typeof SESSION_TERMS)[number],
  sessionNumber: 1,
});

export default function Sessions() {
  const { isProgramManager, isYBF } = useUser();
  const { toast } = useToast();
  const [termFilter, setTermFilter] = useState<string>("all");
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const filtered = sessionsList.filter(
    (s) => termFilter === "all" || s.term === termFilter,
  );
  const avgAttendance = Math.round(
    sessionsList.reduce(
      (s, ses) =>
        s + (ses.attendanceCount / Math.max(ses.totalYouth, 1)) * 100,
      0,
    ) / Math.max(sessionsList.length, 1),
  );
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const validateSessionForm = () => {
    const errs: Record<string, string> = {};
    if (!form.cohortId) errs.cohortId = "Cohort is required";
    if (!form.topic?.trim()) errs.topic = "Topic is required";
    if (form.topic && form.topic.length > MAX.topic)
      errs.topic = `Topic must be ≤ ${MAX.topic} chars`;
    if (!form.session_date) errs.session_date = "Session date is required";
    if (!SESSION_TERMS.includes(form.term as any)) errs.term = "Term is required";
    if (form.venue && form.venue.length > MAX.venue)
      errs.venue = `Venue must be ≤ ${MAX.venue} chars`;
    if (!form.sessionNumber || Number(form.sessionNumber) <= 0)
      errs.sessionNumber = "Session number must be > 0";
    return errs;
  };

  const formValid = Object.keys(validateSessionForm()).length === 0;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [rows, cohortRows] = await Promise.all([
          getSessions(),
          getCohorts(),
        ]);
        if (!mounted) return;
        setSessionsList(
          Array.isArray(rows) ? rows.map(normalizeSessionRow) : [],
        );
        const options = Array.isArray(cohortRows)
          ? cohortRows.map((c: any) => ({
              id: String(c.id),
              label:
                c.label ||
                (c.partner_name
                  ? `Cohort ${c.program_year} — ${c.partner_name}`
                  : `Cohort ${c.program_year}`),
            }))
          : [];
        setCohorts(options);
        if (options.length > 0) {
          setForm((prev) => ({
            ...prev,
            cohortId: prev.cohortId || options[0].id,
          }));
        }
      } catch (err) {
        console.error("Failed to load sessions", err);
        if (mounted) {
          setSessionsList([]);
          setCohorts([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!newOpen) {
      setForm({ ...defaultForm(), cohortId: cohorts[0]?.id ?? "" });
      setFieldErrors({});
      return;
    }
    if (cohorts.length > 0) {
      setForm((prev) => ({
        ...prev,
        cohortId: prev.cohortId || cohorts[0].id,
      }));
    }
  }, [newOpen, cohorts]);

  const handleCreate = async () => {
    const errs = validateSessionForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setCreating(true);
    try {
      await createSession({
        cohort_id: form.cohortId,
        topic: form.topic.trim(),
        session_date: form.session_date,
        venue: form.venue || "",
        term_number: form.term === "Term 1" ? 1 : 2,
        session_number: Number(form.sessionNumber) || 1,
      });
      const refreshed = await getSessions();
      setSessionsList(
        Array.isArray(refreshed) ? refreshed.map(normalizeSessionRow) : [],
      );
      setNewOpen(false);
      toast({
        title: "Session scheduled",
        description: `"${form.topic}" was added successfully.`,
      });
    } catch (err: any) {
      const message = err?.message || "Failed to create session";
      setFieldErrors({ submit: message });
      toast({
        title: "Could not create session",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Session & Attendance</h1>
          <p className="page-description">
            Plan sessions and track attendance across cohorts
          </p>
        </div>
        {(isProgramManager() || isYBF()) && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                <Plus className="h-4 w-4 mr-1" /> New Session
              </Button>
            </DialogTrigger>
            <FormDialogShell
              theme="session"
              icon={CalendarCheck}
              title="Schedule Session"
              subtitle="Add a session to a cohort schedule"
            >
              <div className="space-y-4">
                <FormSection theme="session" title="Session details">
                  <div>
                    <Label htmlFor="session-cohort">Cohort</Label>
                    {cohorts.length > 0 ? (
                      <Select
                        value={form.cohortId || undefined}
                        onValueChange={(v) => {
                          setForm({ ...form, cohortId: v });
                          setFieldErrors((p) => ({ ...p, cohortId: "" }));
                        }}
                      >
                        <SelectTrigger id="session-cohort" className="bg-white/80">
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
                        No cohorts available.
                      </p>
                    )}
                    <FormFieldError message={fieldErrors.cohortId} />
                  </div>
                  <div>
                    <Label htmlFor="session-topic">Topic</Label>
                    <Input
                      id="session-topic"
                      value={form.topic}
                      onChange={(e) => {
                        setForm({ ...form, topic: e.target.value });
                        setFieldErrors((p) => ({ ...p, topic: "" }));
                      }}
                      placeholder="Session topic"
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.topic} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="session-date">Date</Label>
                      <Input
                        id="session-date"
                        type="date"
                        value={form.session_date}
                        onChange={(e) =>
                          setForm({ ...form, session_date: e.target.value })
                        }
                        className="bg-white/80"
                      />
                      <FormFieldError message={fieldErrors.session_date} />
                    </div>
                    <div>
                      <Label htmlFor="session-number">Session #</Label>
                      <Input
                        id="session-number"
                        type="number"
                        min={1}
                        value={String(form.sessionNumber)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            sessionNumber: Number(e.target.value),
                          })
                        }
                        className="bg-white/80"
                      />
                      <FormFieldError message={fieldErrors.sessionNumber} />
                    </div>
                  </div>
                </FormSection>
                <FormSection theme="session" title="Logistics">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="session-term">Term</Label>
                      <select
                        id="session-term"
                        value={form.term}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            term: e.target.value as (typeof SESSION_TERMS)[number],
                          })
                        }
                        className={formSelectClass}
                      >
                        {SESSION_TERMS.map((term) => (
                          <option key={term} value={term}>
                            {term}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="session-venue">Venue</Label>
                      <Input
                        id="session-venue"
                        value={form.venue}
                        onChange={(e) =>
                          setForm({ ...form, venue: e.target.value })
                        }
                        className="bg-white/80"
                      />
                      <FormFieldError message={fieldErrors.venue} />
                    </div>
                  </div>
                </FormSection>
                <FormFieldError message={fieldErrors.submit} />
                <FormActions
                  theme="session"
                  onCancel={() => setNewOpen(false)}
                  onSubmit={handleCreate}
                  submitLabel={creating ? "Saving…" : "Save Session"}
                  disabled={!formValid || cohorts.length === 0 || creating}
                />
              </div>
            </FormDialogShell>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Sessions"
          value={sessionsList.length}
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
          title="Sessions This Term"
          value={sessionsList.filter((s) => s.term === "Term 1").length}
          subtitle="Term 1"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading sessions…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No sessions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">
                      {s.date || s.session_date}
                    </TableCell>
                    <TableCell className="font-medium">
                      #{s.sessionNumber || s.session_number}
                    </TableCell>
                    <TableCell>{s.topic}</TableCell>
                    <TableCell>{s.partner || s.partner_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.term}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">
                        {s.attendanceCount ?? s.attendance_count ?? 0}/
                        {s.totalYouth ?? s.total_youth ?? 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
