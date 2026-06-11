import { useEffect, useMemo, useState } from "react";
import { getYouth, getCases, createCase } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Plus,
  FolderOpen,
  AlertTriangle,
  Clock,
  Flag,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import {
  YBF_CASE_CATEGORIES,
  categoryColors,
  normalizeCaseNote,
  normalizeYouthRow,
} from "./utils";

const MAX_NOTE = 800;

export default function YBFCases() {
  const { user } = useUser();
  const { toast } = useToast();
  const [notes, setNotes] = useState<ReturnType<typeof normalizeCaseNote>[]>([]);
  const [youthList, setYouthList] = useState<
    ReturnType<typeof normalizeYouthRow>[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    youthId: "",
    category: "General Update",
    note: "",
    followUpDate: "",
    flagAtRisk: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    Promise.all([getYouth(), getCases()])
      .then(([youthRows, caseRows]) => {
        if (!mounted) return;
        setYouthList(
          Array.isArray(youthRows) ? youthRows.map(normalizeYouthRow) : [],
        );
        setNotes(
          Array.isArray(caseRows) ? caseRows.map(normalizeCaseNote) : [],
        );
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filteredNotes = useMemo(
    () =>
      notes.filter(
        (n) => categoryFilter === "all" || n.category === categoryFilter,
      ),
    [notes, categoryFilter],
  );

  const activeCases = useMemo(
    () => new Set(notes.map((n) => n.youthId)).size,
    [notes],
  );
  const atRiskNotes = notes.filter((n) => n.category === "At-Risk Flag").length;
  const pendingFollowUps = notes.filter((n) => n.followUpDate).length;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.youthId) errs.youthId = "Please select a youth";
    if (!form.note.trim()) errs.note = "Note text is required";
    if (form.note.length > MAX_NOTE)
      errs.note = `Note must be ${MAX_NOTE} characters or fewer`;
    return errs;
  };

  const resetForm = () => {
    setForm({
      youthId: "",
      category: "General Update",
      note: "",
      followUpDate: "",
      flagAtRisk: false,
    });
    setErrors({});
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const category = form.flagAtRisk ? "At-Risk Flag" : form.category;
      const payload: Record<string, unknown> = {
        youth_id: form.youthId,
        category,
        note_text: form.note.trim(),
      };
      if (form.followUpDate) {
        payload.follow_up_due = form.followUpDate;
        payload.follow_up_required = true;
      }

      const created = await createCase(payload);
      const youth = youthList.find((y) => y.id === form.youthId);
      const newNote = normalizeCaseNote({
        ...created,
        youth_name: youth?.fullName,
        author_name: user?.name,
      });

      setNotes((prev) => [newNote, ...prev]);
      setOpen(false);
      setConfirmOpen(false);
      resetForm();
      toast({
        title: "Case note saved",
        description: form.flagAtRisk
          ? `${youth?.fullName} has been flagged for follow-up.`
          : `Note added for ${youth?.fullName}.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not save case note",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Case Management</h1>
          <p className="page-description">
            View case files for your youth, add notes, flag follow-ups, and log
            field visits.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Case Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Case Note</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="case-youth">Youth</Label>
                <select
                  id="case-youth"
                  value={form.youthId}
                  onChange={(e) => {
                    setForm({ ...form, youthId: e.target.value });
                    setErrors({ ...errors, youthId: "" });
                  }}
                  className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <option value="">Select youth from your roster</option>
                  {youthList.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.fullName} — {y.partner}
                    </option>
                  ))}
                </select>
                {errors.youthId && (
                  <p className="text-sm text-destructive mt-1">{errors.youthId}</p>
                )}
              </div>

              <div>
                <Label htmlFor="case-category">Category</Label>
                <select
                  id="case-category"
                  value={form.category}
                  disabled={form.flagAtRisk}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm disabled:opacity-60"
                >
                  {YBF_CASE_CATEGORIES.filter((c) => c !== "At-Risk Flag").map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/40">
                <input
                  type="checkbox"
                  id="flag-at-risk"
                  checked={form.flagAtRisk}
                  onChange={(e) =>
                    setForm({ ...form, flagAtRisk: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="flag-at-risk" className="cursor-pointer flex items-center gap-1.5">
                  <Flag className="h-4 w-4 text-destructive" />
                  Flag youth for follow-up (At-Risk)
                </Label>
              </div>

              <div>
                <Label htmlFor="case-note">Note</Label>
                <textarea
                  id="case-note"
                  value={form.note}
                  onChange={(e) => {
                    setForm({ ...form, note: e.target.value });
                    setErrors({ ...errors, note: "" });
                  }}
                  rows={4}
                  placeholder="Describe the intervention, field visit findings, or update…"
                  className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.note.length}/{MAX_NOTE} characters
                </p>
                {errors.note && (
                  <p className="text-sm text-destructive mt-1">{errors.note}</p>
                )}
              </div>

              <div>
                <Label htmlFor="case-follow">Follow-up Date (optional)</Label>
                <Input
                  id="case-follow"
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) =>
                    setForm({ ...form, followUpDate: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const errs = validate();
                    if (Object.keys(errs).length > 0) {
                      setErrors(errs);
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  Review & Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Cases"
          value={activeCases}
          icon={FolderOpen}
          variant="primary"
        />
        <StatCard
          title="At-Risk Flags"
          value={atRiskNotes}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Pending Follow-ups"
          value={pendingFollowUps}
          icon={Clock}
          variant="success"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...YBF_CASE_CATEGORIES].map((c) => (
          <Button
            key={c}
            variant={categoryFilter === c ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(c)}
          >
            {c === "all" ? "All" : c}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading case files…
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No case notes yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first case note to start tracking youth journeys.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{note.youthName}</span>
                  <Badge
                    className={categoryColors[note.category] || ""}
                    variant="secondary"
                  >
                    {note.category}
                  </Badge>
                  {note.followUpRequired && (
                    <Badge variant="outline" className="text-warning">
                      Follow-up required
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line">{note.note}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>By {note.author}</span>
                  <span>·</span>
                  <span>{note.date}</span>
                  {note.followUpDate && (
                    <>
                      <span>·</span>
                      <span className="text-warning font-medium">
                        Follow-up: {note.followUpDate}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this case note?</AlertDialogTitle>
            <AlertDialogDescription>
              {form.flagAtRisk
                ? "This will flag the youth as at-risk and create a follow-up record."
                : "This note will be added to the youth's case file and visible to your team."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Yes, save note"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
