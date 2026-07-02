import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <CardContent className="grid md:grid-cols-3 gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-sm font-medium mb-2">{section.title}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {section.items.map((item) => (
                <li key={item.label} className="flex justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="font-semibold text-foreground">
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
