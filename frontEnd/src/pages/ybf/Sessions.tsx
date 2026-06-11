import { useEffect, useMemo, useState } from "react";
import {
  getSessions,
  getYouth,
  getAttendance,
  createBulkAttendance,
} from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
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
import { CalendarCheck, CheckCircle2, ClipboardCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";
import {
  ATTENDANCE_STATUSES,
  normalizeSessionRow,
  normalizeYouthRow,
  type AttendanceStatus,
} from "./utils";

type AttendanceMap = Record<string, AttendanceStatus>;

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

  useEffect(() => {
    let mounted = true;
    Promise.all([getSessions(), getYouth(), getAttendance()])
      .then(([sessionRows, youthRows, attRows]) => {
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
      <div className="page-header">
        <h1 className="page-title">Session Schedule</h1>
        <p className="page-description">
          View your cohort session plan and mark attendance per session — bulk
          or individual.
        </p>
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
