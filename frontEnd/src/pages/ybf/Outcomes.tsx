import { useEffect, useMemo, useState } from "react";
import { getYouth, getOutcomes, createOutcome } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { TrendingUp, Search, FileText } from "lucide-react";
import { StatCard } from "@/components/StatCard";
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

  const summary = useMemo(() => {
    const counts = { completed: 0, inProgress: 0, notStarted: 0 };
    for (const r of rows) {
      for (const type of MILESTONE_TYPES) {
        const s = r.milestones[type].status;
        if (s === "Completed") counts.completed += 1;
        else if (s === "In Progress") counts.inProgress += 1;
        else counts.notStarted += 1;
      }
    }
    return counts;
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
      <div className="page-header">
        <h1 className="page-title">Output Tracking</h1>
        <p className="page-description">
          Update business plan, CV, and application letter status for each youth
          in your cohorts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Completed"
          value={summary.completed}
          subtitle="Milestones done"
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="In Progress"
          value={summary.inProgress}
          icon={FileText}
          variant="warning"
        />
        <StatCard
          title="Not Started"
          value={summary.notStarted}
          icon={FileText}
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search youth…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading output data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No youth to track</p>
              <p className="text-sm text-muted-foreground mt-1">
                Youth in your assigned cohorts will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Youth</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Business Plan</TableHead>
                  <TableHead>CV</TableHead>
                  <TableHead>Cover Letter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.youth.id}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingUpdate}
        onOpenChange={(v) => !v && setPendingUpdate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update output status?</AlertDialogTitle>
            <AlertDialogDescription>
              Set <strong>{pendingUpdate?.type}</strong> for{" "}
              <strong>{pendingUpdate?.youthName}</strong> to{" "}
              <Badge variant="secondary">{pendingUpdate?.status}</Badge>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate} disabled={saving}>
              {saving ? "Saving…" : "Yes, update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MilestoneSelect({
  status,
  onChange,
}: {
  status: MilestoneStatus;
  onChange: (status: MilestoneStatus) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${milestoneStatusColor(status)}`}
        title={status}
      />
      <Select value={status} onValueChange={(v) => onChange(v as MilestoneStatus)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
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
