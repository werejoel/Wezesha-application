import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

type Breakdown = { label: string; count: number };

export function DashboardFilterBreakdown({
  breakdown,
}: {
  breakdown?: {
    byRegion?: Breakdown[];
    byProgramType?: Breakdown[];
    byYear?: Breakdown[];
  };
}) {
  if (!breakdown) return null;

  const sections = [
    { title: "By Region", items: breakdown.byRegion || [] },
    { title: "By Program Type", items: breakdown.byProgramType || [] },
    { title: "By Year", items: breakdown.byYear || [] },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Youth by Category</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm ring-1 ring-inset ring-slate-200/40 dark:border-primary/20 dark:ring-slate-800/40"
          >
            <div className="border-b border-border bg-primary/5 px-4 py-3 dark:bg-primary/10">
              <p className="text-sm font-semibold text-primary dark:text-primary-100">
                {section.title}
              </p>
            </div>
            <Table className="min-w-full bg-transparent">
              <TableHeader>
                <TableRow className="bg-primary/10 text-left dark:bg-primary/15">
                  <TableHead className="text-xs uppercase tracking-[0.2em] text-primary/70 dark:text-primary/40">
                    Category
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.2em] text-primary/70 dark:text-primary/40">
                    Count
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item) => (
                  <TableRow
                    key={item.label}
                    className="hover:bg-primary/10 odd:bg-slate-50 even:bg-white dark:odd:bg-slate-950/60 dark:even:bg-slate-900/60"
                  >
                    <TableCell className="text-sm text-slate-900 dark:text-slate-100">
                      {item.label}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {item.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
