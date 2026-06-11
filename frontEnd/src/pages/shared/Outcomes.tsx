import { getYouth } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { formatMoney } from "@/lib/utils";
import { TrendingUp, DollarSign, Briefcase, Store } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useMemo, useState } from "react";

type OutcomeYouth = {
  baselineIncome: number;
  currentIncome: number;
  employmentStatus: string;
  hasBusiness: boolean;
  aboveIPL: boolean;
};

function normalizeOutcomeYouth(item: any): OutcomeYouth {
  return {
    baselineIncome: Number(item.baseline_income ?? item.baselineIncome ?? 0),
    currentIncome: Number(item.current_income ?? item.currentIncome ?? 0),
    employmentStatus:
      item.employment_status || item.employmentStatus || "Unemployed",
    hasBusiness: Boolean(item.has_business ?? item.hasBusiness ?? false),
    aboveIPL: Boolean(item.above_ipl ?? item.aboveIPL ?? false),
  };
}

const COLORS = [
  "hsl(152, 55%, 33%)",
  "hsl(38, 90%, 55%)",
  "hsl(210, 80%, 52%)",
  "hsl(0, 72%, 51%)",
];

export default function Outcomes() {
  const [youth, setYouth] = useState<OutcomeYouth[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadYouth = async () => {
      try {
        setLoading(true);
        const rows = await getYouth();
        if (!mounted) return;
        setYouth(Array.isArray(rows) ? rows.map(normalizeOutcomeYouth) : []);
      } catch (err) {
        console.error("Failed to load outcomes youth", err);
        if (mounted) setYouth([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadYouth();
    return () => {
      mounted = false;
    };
  }, []);

  const totalYouth = youth.length;
  const avgIncome = totalYouth
    ? Math.round(
        youth.reduce((sum, y) => sum + y.currentIncome, 0) / totalYouth,
      )
    : 0;
  const avgBaselineIncome = totalYouth
    ? Math.round(
        youth.reduce((sum, y) => sum + y.baselineIncome, 0) / totalYouth,
      )
    : 0;
  const aboveIPL = youth.filter((y) => y.aboveIPL).length;
  const businessStarted = youth.filter((y) => y.hasBusiness).length;

  const employmentData = useMemo(
    () => [
      {
        name: "Full-time",
        value: youth.filter((y) => y.employmentStatus === "Employed Full-time")
          .length,
      },
      {
        name: "Part-time",
        value: youth.filter((y) => y.employmentStatus === "Employed Part-time")
          .length,
      },
      {
        name: "Self-employed",
        value: youth.filter((y) => y.employmentStatus === "Self-employed")
          .length,
      },
      {
        name: "Unemployed",
        value: youth.filter((y) => y.employmentStatus === "Unemployed").length,
      },
    ],
    [youth],
  );

  const incomeChangeData = useMemo(
    () => [
      {
        range: "< 0",
        count: youth.filter((y) => y.currentIncome < y.baselineIncome).length,
      },
      {
        range: "0-3K",
        count: youth.filter((y) => {
          const d = y.currentIncome - y.baselineIncome;
          return d >= 0 && d < 3000;
        }).length,
      },
      {
        range: "3K-6K",
        count: youth.filter((y) => {
          const d = y.currentIncome - y.baselineIncome;
          return d >= 3000 && d < 6000;
        }).length,
      },
      {
        range: "6K-10K",
        count: youth.filter((y) => {
          const d = y.currentIncome - y.baselineIncome;
          return d >= 6000 && d < 10000;
        }).length,
      },
      {
        range: "10K+",
        count: youth.filter((y) => y.currentIncome - y.baselineIncome >= 10000)
          .length,
      },
    ],
    [youth],
  );

  const safeTotal = Math.max(totalYouth, 1);
  const inWorkPercentage = Math.round(
    ((totalYouth - employmentData[3].value) / safeTotal) * 100,
  );
  const abovePLPercentage = Math.round((aboveIPL / safeTotal) * 100);
  const businessPercentage = Math.round((businessStarted / safeTotal) * 100);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Outcomes & Impact Data</h1>
        <p className="page-description">
          Track employment, income changes, and impact indicators
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Avg Income Change"
          value={
            totalYouth
              ? `+${Math.round(((avgIncome - avgBaselineIncome) / Math.max(avgBaselineIncome, 1)) * 100)}%`
              : "0%"
          }
          subtitle={`${formatMoney(avgBaselineIncome)} → ${formatMoney(avgIncome)}`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Above Poverty Line"
          value={`${abovePLPercentage}%`}
          subtitle={`${aboveIPL} of ${totalYouth} youth`}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="In Work"
          value={`${inWorkPercentage}%`}
          icon={Briefcase}
        />
        <StatCard
          title="Businesses Started"
          value={businessStarted}
          subtitle={`${businessPercentage}% of youth`}
          icon={Store}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">
              Employment Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={employmentData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {employmentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">
              Income Change Distribution (UGX)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeChangeData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(40, 15%, 89%)"
                />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(152, 55%, 33%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">
            Key Outcome Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: "Youth Currently in Work",
                value: `${inWorkPercentage}%`,
                desc: "Employed or self-employed vs enrolled",
              },
              {
                label: "Avg Income Increase",
                value: formatMoney(avgIncome - avgBaselineIncome),
                desc: "Average across all youth with updated data",
              },
              {
                label: "Above Poverty Line",
                value: `${aboveIPL} youth`,
                desc: `${abovePLPercentage}% of total enrolled`,
              },
              {
                label: "Businesses Started",
                value: `${businessStarted}`,
                desc: "Since enrollment in program",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="text-center p-4 rounded-xl bg-muted/50"
              >
                <p className="text-2xl font-bold font-heading">{item.value}</p>
                <p className="text-sm font-medium mt-1">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
