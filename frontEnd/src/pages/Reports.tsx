import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Users, CalendarCheck, TrendingUp } from "lucide-react";

const reports = [
  {
    title: 'Session Attendance Report',
    description: 'Attendance data by cohort, term, or individual youth with rates and flags.',
    icon: CalendarCheck,
    filters: ['By Cohort', 'By Term', 'By Youth'],
  },
  {
    title: 'Output Completion Report',
    description: 'Business plan, CV, and application letter completion rates across cohorts.',
    icon: FileText,
    filters: ['By Cohort', 'By Program Type'],
  },
  {
    title: 'Youth Enrollment Summary',
    description: 'Complete enrollment data with demographics, baseline profiling, and partner distribution.',
    icon: Users,
    filters: ['By Partner', 'By Region', 'By Gender'],
  },
  {
    title: 'Outcome & Impact Report',
    description: 'Employment status changes, income trends, IPL analysis, and SROI data preparation.',
    icon: TrendingUp,
    filters: ['Full Report', 'By Cohort', 'SROI Export'],
  },
];

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports & Data Exports</h1>
        <p className="page-description">Generate reports for donor reporting, internal reviews, and SROI calculations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(report => (
          <Card key={report.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <report.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base font-heading">{report.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {report.filters.map(f => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
                <Button size="sm"><Download className="h-3.5 w-3.5 mr-1" /> Export PDF</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
