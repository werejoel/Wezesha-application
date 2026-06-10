import { getYouth, getCases, createCase } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FolderOpen, AlertTriangle, Clock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MAX = { note: 800 };

const categoryColors: Record<string, string> = {
  'General Update': 'bg-info text-info-foreground',
  'At-Risk Flag': 'bg-destructive text-destructive-foreground',
  'Business Support': 'bg-success text-success-foreground',
  'Employment Lead': 'bg-warning text-warning-foreground',
  'Other': 'bg-muted text-muted-foreground',
};

const categories = ['all', 'General Update', 'At-Risk Flag', 'Business Support', 'Employment Lead', 'Other'];

const normalizeCaseNote = (item: any) => ({
  id: String(item.id),
  youthId: String(item.youth_id || item.youthId || ''),
  youthName:
    item.youth_name ||
    item.youth_full_name ||
    item.youthName ||
    `Youth ${item.youth_id || item.youthId || ''}`,
  author: item.author_name || item.author || 'Unknown',
  date: item.created_at
    ? new Date(item.created_at).toLocaleDateString()
    : item.date || new Date().toLocaleDateString(),
  category: item.category || 'Other',
  note: item.note_text || item.note || '',
  followUpDate: item.follow_up_due ? String(item.follow_up_due).split('T')[0] : item.followUpDate || undefined,
  assignedTo: item.assigned_to || item.assignedTo || undefined,
});

export default function Cases() {
  const { isProgramManager, isYBF, user } = useUser();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [notes, setNotes] = useState<any[]>([]);
  const [youthList, setYouthList] = useState<any[]>([]);
  const [loadingYouth, setLoadingYouth] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ youthId: '', category: 'General Update', note: '', followUpDate: '', assignedTo: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const filteredNotes = useMemo(
    () => notes.filter((note) => categoryFilter === 'all' || note.category === categoryFilter),
    [categoryFilter, notes],
  );
  const activeCaseCount = useMemo(() => new Set(notes.map((note) => note.youthId)).size, [notes]);
  const atRiskCount = useMemo(
    () => notes.filter((note) => note.category === 'At-Risk Flag').length,
    [notes],
  );
  const pendingFollowUp = useMemo(
    () => notes.filter((note) => note.followUpDate).length,
    [notes],
  );

  // Load youth list and case history from backend
  useEffect(() => {
    let mounted = true;

    const loadYouth = async () => {
      try {
        setLoadingYouth(true);
        const rows = await getYouth();
        if (!mounted) return;
        setYouthList(rows || []);
      } catch (err) {
        setYouthList([]);
      } finally {
        if (mounted) setLoadingYouth(false);
      }
    };

    const loadCases = async () => {
      try {
        setLoadingCases(true);
        const rows = await getCases();
        if (!mounted) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setNotes(rows.map(normalizeCaseNote));
        }
      } catch (err) {
        console.warn('Failed to load cases', err);
      } finally {
        if (mounted) setLoadingCases(false);
      }
    };

    loadYouth();
    loadCases();

    return () => {
      mounted = false;
    };
  }, []);

  const validateCaseForm = () => {
    const errs: Record<string,string> = {};
    if (!form.youthId) errs.youthId = 'Select a youth';
    if (!form.note || !form.note.trim()) errs.note = 'Note text is required';
    if (form.note && form.note.length > MAX.note) errs.note = `Note must be ≤ ${MAX.note} chars`;
    return errs;
  };

  const handleSaveCaseNote = async () => {
    const errs = validateCaseForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      const payload: any = {
        youth_id: form.youthId,
        category: form.category,
        note_text: form.note,
      };
      if (form.followUpDate) {
        payload.follow_up_due = form.followUpDate;
        payload.follow_up_required = true;
      }

      const created = await createCase(payload);
      const newNote = normalizeCaseNote({
        ...created,
        youth_name:
          created.youth_name ||
          youthList.find((y) => String(y.id) === String(created.youth_id))?.full_name ||
          youthList.find((y) => String(y.id) === String(created.youth_id))?.fullName ||
          `Youth ${created.youth_id}`,
        author_name: created.author_name || user?.name || 'You',
        assigned_to: form.assignedTo || undefined,
      });

      setNotes((prev) => [newNote, ...prev]);
      setOpen(false);
      setForm({ youthId: '', category: 'General Update', note: '', followUpDate: '', assignedTo: '' });
      setFieldErrors({});
    } catch (err: any) {
      console.error('Create case error', err);
      setFieldErrors({ ...fieldErrors, note: err?.message || 'Failed to save case note' });
    }
  };

  const formValid = Object.keys(validateCaseForm()).length === 0;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Case Management</h1>
          <p className="page-description">Track youth journeys, interventions, and follow-ups</p>
        </div>
        {(isProgramManager() || isYBF()) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Case Note</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Case Note</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="case-youth">Youth</Label>
                  <select id="case-youth" value={form.youthId} onChange={e => { setForm({ ...form, youthId: e.target.value }); setFieldErrors({ ...fieldErrors, youthId: '' }); }} className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select youth</option>
                    {loadingYouth ? <option>Loading...</option> : youthList.map(y => <option key={y.id} value={String(y.id)}>{y.full_name || y.fullName} — {y.partner_name || y.partner}</option>)}
                  </select>
                  {fieldErrors.youthId && <p className="text-sm text-destructive mt-1">{fieldErrors.youthId}</p>}
                </div>
                <div>
                  <Label htmlFor="case-category">Category</Label>
                  <select id="case-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                    {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="case-note">Note</Label>
                  <textarea id="case-note" value={form.note} onChange={e => { setForm({ ...form, note: e.target.value }); setFieldErrors({ ...fieldErrors, note: '' }); }} className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" rows={4} />
                  {fieldErrors.note && <p className="text-sm text-destructive mt-1">{fieldErrors.note}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="case-follow">Follow-up Date</Label>
                    <Input id="case-follow" type="date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="case-assigned">Assign To</Label>
                    <Input id="case-assigned" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); setFieldErrors({}); }}>Cancel</Button>
                  <Button onClick={handleSaveCaseNote} disabled={!formValid}>Save Case Note</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Cases" value={activeCaseCount} icon={FolderOpen} variant="primary" />
        <StatCard title="At-Risk Notes" value={atRiskCount} icon={AlertTriangle} variant="warning" />
        <StatCard title="Pending Follow-ups" value={pendingFollowUp} icon={Clock} variant="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button key={c} variant={categoryFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(c)}>
            {c === 'all' ? 'All Categories' : c}
          </Button>
        ))}
      </div>

      {loadingCases ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Loading case history…</div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{note.youthName}</span>
                      <Badge className={categoryColors[note.category] || ''} variant="secondary">
                        {note.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{note.note}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>By {note.author}</span>
                      <span>·</span>
                      <span>{note.date}</span>
                      {note.followUpDate && (
                        <>
                          <span>·</span>
                          <span className="text-warning font-medium">Follow-up: {note.followUpDate}</span>
                        </>
                      )}
                      {note.assignedTo && (
                        <>
                          <span>·</span>
                          <span>Assigned to: {note.assignedTo}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredNotes.length === 0 && (
            <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              No case notes found for the selected category.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

