import { useEffect, useMemo, useState } from "react";
import { getYouth } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, AlertTriangle, Search } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { normalizeYouthRow } from "./utils";

export default function YBFYouth() {
  const [youthList, setYouthList] = useState<ReturnType<typeof normalizeYouthRow>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "at-risk">("all");

  useEffect(() => {
    let mounted = true;
    getYouth()
      .then((rows) => {
        if (!mounted) return;
        setYouthList(
          Array.isArray(rows) ? rows.map(normalizeYouthRow) : [],
        );
      })
      .catch(() => mounted && setYouthList([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return youthList.filter((y) => {
      if (filter === "at-risk" && !y.riskFlag && y.attendanceRate >= 70)
        return false;
      if (!q) return true;
      return (
        y.fullName.toLowerCase().includes(q) ||
        y.partner.toLowerCase().includes(q) ||
        y.district.toLowerCase().includes(q)
      );
    });
  }, [youthList, search, filter]);

  const atRiskCount = youthList.filter(
    (y) => y.riskFlag || y.attendanceRate < 70,
  ).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Youth Roster</h1>
        <p className="page-description">
          View youth profiles within your assigned cohorts only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Youth"
          value={youthList.length}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="At-Risk"
          value={atRiskCount}
          subtitle="Low attendance or flagged"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Avg Attendance"
          value={
            youthList.length
              ? `${Math.round(
                  youthList.reduce((s, y) => s + y.attendanceRate, 0) /
                    youthList.length,
                )}%`
              : "—"
          }
          icon={Users}
          variant="success"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, partner, or district…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "at-risk"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "All Youth" : "At-Risk"}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading youth roster…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No youth found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {youthList.length === 0
                  ? "You have no youth in your assigned cohorts yet."
                  : "Try adjusting your search or filter."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((y) => (
                  <YouthProfileDialog key={y.id} youth={y} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function YouthProfileDialog({
  youth: y,
}: {
  youth: ReturnType<typeof normalizeYouthRow>;
}) {
  const isAtRisk = y.riskFlag || y.attendanceRate < 70;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">{y.fullName}</TableCell>
          <TableCell>{y.gender}</TableCell>
          <TableCell>{y.partner}</TableCell>
          <TableCell>
            <Badge variant="secondary">{y.programType || "—"}</Badge>
          </TableCell>
          <TableCell>
            <span
              className={
                y.attendanceRate < 70
                  ? "text-destructive font-semibold"
                  : "font-semibold"
              }
            >
              {y.attendanceRate}%
            </span>
          </TableCell>
          <TableCell>
            {isAtRisk ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                At-Risk
              </Badge>
            ) : (
              <Badge variant="outline">On Track</Badge>
            )}
          </TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{y.fullName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Date of Birth</span>
            <p className="font-medium">{y.dob || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Gender</span>
            <p className="font-medium">{y.gender || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">District</span>
            <p className="font-medium">{y.district || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Attendance</span>
            <p className="font-medium">{y.attendanceRate}%</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Partner Institution</span>
            <p className="font-medium">{y.partner || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Cohort</span>
            <p className="font-medium">{y.cohort || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Program Type</span>
            <p className="font-medium">{y.programType || "—"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
