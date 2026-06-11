import { useEffect, useMemo, useState, type ComponentType } from "react";
import { getYouth, getOutcomes, createOutcome } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TrendingUp,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  CircleDashed,
  Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  MILESTONE_TYPES,
  MILESTONE_STATUSES,
  milestoneStatusColor,
  normalizeYouthRow,
  type MilestoneStatus,
  type MilestoneType,
} from "./utils";

type YouthMilestones = {
  youth: ReturnType<typeof normalizeYouthRow>;
  milestones: Record<MilestoneType, { id?: string; status: MilestoneStatus }>;
};

const defaultMilestones = (): Record<
  MilestoneType,
  { status: MilestoneStatus }
> => ({
  "Business Plan": { status: "Not Started" },
  CV: { status: "Not Started" },
  "Application Letter": { status: "Not Started" },
});

const MILESTONE_META: Record<
  MilestoneType,
  { color: string; bar: string; badge: string }
> = {
  "Business Plan": {
    color: "text-emerald-700",
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  CV: {
    color: "text-sky-700",
    bar: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
  },
  "Application Letter": {
    color: "text-violet-700",
    bar: "bg-violet-500",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
  },
};

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  Completed: "bg-success/15 text-success border-success/30",
  "In Progress": "bg-warning/15 text-warning-foreground border-warning/30",
  "Not Started": "bg-muted text-muted-foreground border-border",
};

export default function YBFOutcomes() {
  const { toast } = useToast();
  const [rows, setRows] = useState<YouthMilestones[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<{
    youthId: string;
    youthName: string;
    type: MilestoneType;
    status: MilestoneStatus;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [youthRows, outcomeRows] = await Promise.all([
      getYouth(),
      getOutcomes(),
    ]);
    const youth = Array.isArray(youthRows)
      ? youthRows.map(normalizeYouthRow)
      : [];
    const outcomes = Array.isArray(outcomeRows) ? outcomeRows : [];

    const merged: YouthMilestones[] = youth.map((y) => {
      const milestones = defaultMilestones();
      for (const o of outcomes) {
        if (String(o.youth_id) !== y.id) continue;
        const type = o.milestone_type as MilestoneType;
        if (MILESTONE_TYPES.includes(type)) {
          milestones[type] = {
            id: String(o.id),
            status: (o.status as MilestoneStatus) || "Not Started",
          };
        }
      }
      return { youth: y, milestones };
    });
    setRows(merged);
  };

  useEffect(() => {
    let mounted = true;
    loadData()
      .catch(() => mounted && setRows([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.youth.fullName.toLowerCase().includes(q) ||
        r.youth.partner.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const analytics = useMemo(() => {
    const total = rows.length;
    const perType: Record<
      MilestoneType,
      { completed: number; inProgress: number; notStarted: number }
    > = {
      "Business Plan": { completed: 0, inProgress: 0, notStarted: 0 },
      CV: { completed: 0, inProgress: 0, notStarted: 0 },
      "Application Letter": { completed: 0, inProgress: 0, notStarted: 0 },
    };
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let youthFullyComplete = 0;

    for (const r of rows) {
      let youthDone = 0;
      for (const type of MILESTONE_TYPES) {
        const s = r.milestones[type].status;
        if (s === "Completed") {
          completed += 1;
          perType[type].completed += 1;
          youthDone += 1;
        } else if (s === "In Progress") {
          inProgress += 1;
          perType[type].inProgress += 1;
        } else {
          notStarted += 1;
          perType[type].notStarted += 1;
        }
      }
      if (youthDone === MILESTONE_TYPES.length) youthFullyComplete += 1;
    }

    const totalMilestones = total * MILESTONE_TYPES.length;
    const completionRate = totalMilestones
      ? Math.round((completed / totalMilestones) * 100)
      : 0;
    const youthCompletionRate = total
      ? Math.round((youthFullyComplete / total) * 100)
      : 0;

    return {
      total,
      completed,
      inProgress,
      notStarted,
      perType,
      completionRate,
      youthCompletionRate,
      youthFullyComplete,
    };
  }, [rows]);

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate) return;
    setSaving(true);
    try {
      await createOutcome({
        youth_id: pendingUpdate.youthId,
        milestone_type: pendingUpdate.type,
        status: pendingUpdate.status,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.youth.id === pendingUpdate.youthId
            ? {
                ...r,
                milestones: {
                  ...r.milestones,
                  [pendingUpdate.type]: {
                    ...r.milestones[pendingUpdate.type],
                    status: pendingUpdate.status,
                  },
                },
              }
            : r,
        ),
      );

      toast({
        title: "Output updated",
        description: `${pendingUpdate.type} for ${pendingUpdate.youthName} set to "${pendingUpdate.status}".`,
      });
      setPendingUpdate(null);
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-emerald-900">Output Tracking</h1>
            <p className="page-description text-emerald-800/70">
              Track business plan, CV, and cover letter progress across your
              cohort youth.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-emerald-200 px-4 py-3 shadow-sm">
            <Target className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold font-heading text-emerald-800">
                {analytics.completionRate}%
              </p>
              <p className="text-xs text-muted-foreground">
                Overall milestone completion
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Completed"
          value={analytics.completed}
          subtitle="Milestones done"
          icon={CheckCircle2}
          accent="from-emerald-500 to-teal-500"
          textColor="text-emerald-700"
        />
        <AnalyticsCard
          title="In Progress"
          value={analytics.inProgress}
          subtitle="Being worked on"
          icon={Clock}
          accent="from-amber-400 to-orange-400"
          textColor="text-amber-700"
        />
        <AnalyticsCard
          title="Not Started"
          value={analytics.notStarted}
          subtitle="Awaiting action"
          icon={CircleDashed}
          accent="from-slate-300 to-slate-400"
          textColor="text-slate-600"
        />
        <AnalyticsCard
          title="Youth Complete"
          value={`${analytics.youthCompletionRate}%`}
          subtitle={`${analytics.youthFullyComplete} of ${analytics.total} youth`}
          icon={TrendingUp}
          accent="from-violet-500 to-purple-500"
          textColor="text-violet-700"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MILESTONE_TYPES.map((type) => {
          const data = analytics.perType[type];
          const total = Math.max(
            data.completed + data.inProgress + data.notStarted,
            1,
          );
          const pct = Math.round((data.completed / total) * 100);
          const meta = MILESTONE_META[type];
          return (
            <Card
              key={type}
              className="border-0 shadow-sm overflow-hidden"
            >
              <div className={`h-1.5 ${meta.bar}`} />
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-heading ${meta.color}`}>
                  {type}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${meta.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs">
                  <div className="rounded-lg bg-emerald-50 py-1.5 text-emerald-700 font-medium">
                    {data.completed}
                    <span className="block text-[10px] font-normal opacity-70">
                      Done
                    </span>
                  </div>
                  <div className="rounded-lg bg-amber-50 py-1.5 text-amber-700 font-medium">
                    {data.inProgress}
                    <span className="block text-[10px] font-normal opacity-70">
                      Active
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-1.5 text-slate-600 font-medium">
                    {data.notStarted}
                    <span className="block text-[10px] font-normal opacity-70">
                      Pending
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600/60" />
        <Input
          placeholder="Search youth…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-emerald-200/60 focus-visible:ring-emerald-500/30"
        />
      </div>

      <Card className="border-emerald-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading output data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-emerald-400 mb-3" />
              <p className="font-medium">No youth to track</p>
              <p className="text-sm text-muted-foreground mt-1">
                Youth in your assigned cohorts will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50/50 hover:bg-emerald-50/50">
                  <TableHead>Youth</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Business Plan</TableHead>
                  <TableHead>CV</TableHead>
                  <TableHead>Cover Letter</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const done = MILESTONE_TYPES.filter(
                    (t) => row.milestones[t].status === "Completed",
                  ).length;
                  const pct = Math.round(
                    (done / MILESTONE_TYPES.length) * 100,
                  );
                  return (
                    <TableRow key={row.youth.id} className="hover:bg-emerald-50/30">
                      <TableCell className="font-medium">
                        {row.youth.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.youth.partner}
                      </TableCell>
                      {MILESTONE_TYPES.map((type) => (
                        <TableCell key={type}>
                          <MilestoneSelect
                            status={row.milestones[type].status}
                            type={type}
                            onChange={(status) =>
                              setPendingUpdate({
                                youthId: row.youth.id,
                                youthName: row.youth.fullName,
                                type,
                                status,
                              })
                            }
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 w-8">
                            {pct}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingUpdate}
        onOpenChange={(v) => !v && setPendingUpdate(null)}
      >
        <AlertDialogContent className="border-emerald-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-900">
              Update output status?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Set <strong>{pendingUpdate?.type}</strong> for{" "}
              <strong>{pendingUpdate?.youthName}</strong> to{" "}
              <Badge
                variant="outline"
                className={
                  pendingUpdate
                    ? STATUS_BADGE[pendingUpdate.status]
                    : undefined
                }
              >
                {pendingUpdate?.status}
              </Badge>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmUpdate}
              disabled={saving}
            >
              {saving ? "Saving…" : "Yes, update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnalyticsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  textColor,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  textColor: string;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <CardContent className="p-4 flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className={`text-2xl font-bold font-heading ${textColor}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MilestoneSelect({
  status,
  type,
  onChange,
}: {
  status: MilestoneStatus;
  type: MilestoneType;
  onChange: (status: MilestoneStatus) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${milestoneStatusColor(status)}`}
        title={status}
      />
      <Select
        value={status}
        onValueChange={(v) => onChange(v as MilestoneStatus)}
      >
        <SelectTrigger
          className={`h-8 w-[128px] text-xs border ${MILESTONE_META[type].badge}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MILESTONE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
