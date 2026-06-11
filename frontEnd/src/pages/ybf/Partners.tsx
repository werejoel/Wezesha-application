import { useEffect, useState } from "react";
import { getPartners } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, User } from "lucide-react";
import { StatCard } from "@/components/StatCard";

type Partner = {
  id: string;
  name: string;
  type: string;
  location: string;
  district: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: string;
  startDate: string;
  cohortsCount: number;
};

function normalizePartner(p: any): Partner {
  return {
    id: String(p.id),
    name: p.name || "Unknown",
    type: (p.type || "TVET").toString().toUpperCase(),
    location: p.location || "—",
    district: p.district || "—",
    contactName: p.contact_name || "—",
    contactPhone: p.contact_phone || "—",
    contactEmail: p.contact_email || "—",
    status: p.status || "Active",
    startDate: p.partnership_date
      ? String(p.partnership_date).split("T")[0]
      : "—",
    cohortsCount: Number(p.cohorts_count ?? 0),
  };
}

export default function YBFPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPartners()
      .then((rows) => {
        if (!mounted) return;
        setPartners(Array.isArray(rows) ? rows.map(normalizePartner) : []);
      })
      .catch(() => mounted && setPartners([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = partners.filter((p) => p.status === "Active").length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">My Institutions</h1>
        <p className="page-description">
          Partner institutions assigned to your cohorts. This view is read-only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned Institutions"
          value={partners.length}
          icon={Building2}
          variant="primary"
        />
        <StatCard
          title="Active Partnerships"
          value={activeCount}
          icon={Building2}
          variant="success"
        />
        <StatCard
          title="Total Cohorts"
          value={partners.reduce((s, p) => s + p.cohortsCount, 0)}
          icon={Building2}
        />
      </div>

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading your institutions…
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No institutions assigned yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your program manager to be assigned to a cohort.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <Card key={p.id} className="animate-fade-in">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold font-heading">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {p.type} · {p.cohortsCount} cohort
                      {p.cohortsCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge
                    variant={p.status === "Active" ? "default" : "secondary"}
                  >
                    {p.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>
                      {p.location}, {p.district}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{p.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{p.contactPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{p.contactEmail}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  Partnership since {p.startDate}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
