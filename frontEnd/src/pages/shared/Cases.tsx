import { caseNotes, youth } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, AlertTriangle, Clock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";

const categoryColors: Record<string, string> = {
  'General Update': 'bg-info text-info-foreground',
  'At-Risk Flag': 'bg-destructive text-destructive-foreground',
  'Business Support': 'bg-success text-success-foreground',
  'Employment Lead': 'bg-warning text-warning-foreground',
  'Other': 'bg-muted text-muted-foreground',
};

export default function Cases() {
  const { isProgramManager, isYBF } = useUser();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const categories = ['all', 'General Update', 'At-Risk Flag', 'Business Support', 'Employment Lead'];
  const filtered = caseNotes.filter(n => categoryFilter === 'all' || n.category === categoryFilter);
  const pendingFollowUp = caseNotes.filter(n => n.followUpDate).length;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Case Management</h1>
          <p className="page-description">Track youth journeys, interventions, and follow-ups</p>
        </div>
        {(isProgramManager() || isYBF()) && (
          <Button><Plus className="h-4 w-4 mr-1" /> Add Case Note</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Cases" value={youth.length} icon={FolderOpen} variant="primary" />
        <StatCard title="At-Risk Youth" value={youth.filter(y => y.riskFlag).length} icon={AlertTriangle} variant="warning" />
        <StatCard title="Pending Follow-ups" value={pendingFollowUp} icon={Clock} variant="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <Button key={c} variant={categoryFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(c)}>
            {c === 'all' ? 'All Categories' : c}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(note => (
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
                  <p className="text-sm text-foreground mt-1">{note.note}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}
