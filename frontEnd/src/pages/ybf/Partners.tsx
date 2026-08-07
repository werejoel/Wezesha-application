import { useEffect, useState } from "react";
import { createPartner, getPartners } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Building2, MapPin, Phone, Mail, User, Plus } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  FormActions,
  FormDialogShell,
  FormFieldError,
  FormSection,
  formSelectClass,
} from "@/components/FormDialogShell";
import { useToast } from "@/hooks/use-toast";

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

const defaultPartnerForm = {
  name: "",
  type: "TVET",
  location: "",
  district: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  status: "Active",
  startDate: new Date().toISOString().slice(0, 10),
  programYear: String(new Date().getFullYear()),
};

const PHONE_RE = /^\+?[0-9 \-]{7,20}$/;

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
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState(defaultPartnerForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadPartners = async () => {
    const rows = await getPartners();
    setPartners(Array.isArray(rows) ? rows.map(normalizePartner) : []);
  };

  useEffect(() => {
    let mounted = true;
    loadPartners()
      .catch(() => mounted && setPartners([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!addOpen) {
      setPartnerForm(defaultPartnerForm);
      setFieldErrors({});
    }
  }, [addOpen]);

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!partnerForm.name.trim()) errs.name = "Institution name is required";
    if (!partnerForm.district.trim()) errs.district = "District is required";
    if (partnerForm.contactPhone && !PHONE_RE.test(partnerForm.contactPhone))
      errs.contactPhone = "Invalid phone format";
    if (
      partnerForm.contactEmail &&
      !/^\S+@\S+\.\S+$/.test(partnerForm.contactEmail)
    )
      errs.contactEmail = "Invalid email";
    const year = Number(partnerForm.programYear);
    if (!partnerForm.programYear.trim())
      errs.programYear = "Program year is required";
    else if (!Number.isInteger(year) || year < 2000 || year > 2100)
      errs.programYear = "Enter a valid year (2000–2100)";
    return errs;
  };

  const formValid = Object.keys(validateForm()).length === 0;

  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const created = await createPartner({
        name: partnerForm.name,
        district: partnerForm.district,
        type: partnerForm.type,
        location: partnerForm.location,
        contact_name: partnerForm.contactName,
        contact_phone: partnerForm.contactPhone,
        contact_email: partnerForm.contactEmail,
        partnership_date: partnerForm.startDate,
        status: partnerForm.status,
        program_year: Number(partnerForm.programYear),
      });
      setPartners((prev) => [
        normalizePartner({ ...created, cohorts_count: 1 }),
        ...prev,
      ]);
      setAddOpen(false);
      toast({
        title: "Partner added",
        description: `${partnerForm.name} has been registered with a ${partnerForm.programYear} cohort.`,
      });
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to save partner" });
    } finally {
      setSaving(false);
    }
  };

  const activeCount = partners.filter((p) => p.status === "Active").length;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">My Institutions</h1>
          <p className="page-description">
            Partner institutions linked to your cohorts — add new ones as
            needed.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> Add Institution
            </Button>
          </DialogTrigger>
          <FormDialogShell
            theme="partner"
            icon={Building2}
            title="Add Partner Institution"
            subtitle="Register a new institution and create its first cohort"
          >
            <div className="space-y-4">
              <FormSection theme="partner" title="Institution">
                <div>
                  <Label htmlFor="ybf-partner-name">Institution Name</Label>
                  <Input
                    id="ybf-partner-name"
                    value={partnerForm.name}
                    onChange={(e) => {
                      setPartnerForm({ ...partnerForm, name: e.target.value });
                      setFieldErrors((p) => ({ ...p, name: "" }));
                    }}
                    placeholder="City Youth Centre"
                    className="bg-white/80"
                  />
                  <FormFieldError message={fieldErrors.name} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ybf-partner-location">Location</Label>
                    <Input
                      id="ybf-partner-location"
                      value={partnerForm.location}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          location: e.target.value,
                        })
                      }
                      placeholder="Kampala YMCA Building"
                      className="bg-white/80"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ybf-partner-district">District</Label>
                    <Input
                      id="ybf-partner-district"
                      value={partnerForm.district}
                      onChange={(e) => {
                        setPartnerForm({
                          ...partnerForm,
                          district: e.target.value,
                        });
                        setFieldErrors((p) => ({ ...p, district: "" }));
                      }}
                      placeholder="Kampala"
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.district} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ybf-partner-type">Type</Label>
                    <select
                      id="ybf-partner-type"
                      value={partnerForm.type}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          type: e.target.value,
                        })
                      }
                      className={formSelectClass}
                    >
                      <option value="TVET">TVET</option>
                      <option value="CBO">CBO</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="ybf-partner-year">Cohort Year</Label>
                    <Input
                      id="ybf-partner-year"
                      type="number"
                      min={2000}
                      max={2100}
                      value={partnerForm.programYear}
                      onChange={(e) => {
                        setPartnerForm({
                          ...partnerForm,
                          programYear: e.target.value,
                        });
                        setFieldErrors((p) => ({ ...p, programYear: "" }));
                      }}
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.programYear} />
                  </div>
                </div>
              </FormSection>

              <FormSection theme="partner" title="Contact">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ybf-partner-contact">Contact Name</Label>
                    <Input
                      id="ybf-partner-contact"
                      value={partnerForm.contactName}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          contactName: e.target.value,
                        })
                      }
                      placeholder="Were Joel"
                      className="bg-white/80"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ybf-partner-phone">Phone</Label>
                    <Input
                      id="ybf-partner-phone"
                      value={partnerForm.contactPhone}
                      onChange={(e) => {
                        setPartnerForm({
                          ...partnerForm,
                          contactPhone: e.target.value,
                        });
                        setFieldErrors((p) => ({ ...p, contactPhone: "" }));
                      }}
                      placeholder="+254712345678"
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.contactPhone} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ybf-partner-email">Email</Label>
                  <Input
                    id="ybf-partner-email"
                    value={partnerForm.contactEmail}
                    onChange={(e) => {
                      setPartnerForm({
                        ...partnerForm,
                        contactEmail: e.target.value,
                      });
                      setFieldErrors((p) => ({ ...p, contactEmail: "" }));
                    }}
                    placeholder="partner@institution.org"
                    className="bg-white/80"
                  />
                  <FormFieldError message={fieldErrors.contactEmail} />
                </div>
              </FormSection>

              <FormFieldError message={fieldErrors.submit} />
              <FormActions
                theme="partner"
                onCancel={() => setAddOpen(false)}
                onSubmit={handleSave}
                submitLabel={saving ? "Saving…" : "Save Institution"}
                disabled={!formValid || saving}
              />
            </div>
          </FormDialogShell>
        </Dialog>
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
        <div className="rounded-xl border border-dashed border-secondary/40 bg-secondary/5 p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-secondary mb-3" />
          <p className="font-medium">No institutions yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add your first partner institution to get started.
          </p>
          <Button
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Institution
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <Card
              key={p.id}
              className="animate-fade-in border-l-4 border-l-secondary/60 hover:shadow-md transition-shadow"
            >
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
                    <MapPin className="h-4 w-4 shrink-0 text-secondary" />
                    <span>
                      {p.location}, {p.district}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0 text-secondary" />
                    <span>{p.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0 text-secondary" />
                    <span>{p.contactPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-secondary" />
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
