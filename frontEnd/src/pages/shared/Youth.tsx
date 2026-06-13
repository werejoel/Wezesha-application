import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Users,
  AlertTriangle,
  Briefcase,
  Edit3,
  Trash2,
  UserPlus,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
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
  createYouth,
  deleteYouth,
  getCohorts,
  getPartners,
  getYouth,
  updateYouth,
} from "@/api";
import { useUser } from "@/hooks/use-user";
import {
  FormActions,
  FormDialogShell,
  FormFieldError,
  FormSection,
  formSelectClass,
} from "@/components/FormDialogShell";

type YouthData = {
  id: string;
  dob?: string;
  fullName: string;
  gender?: string;
  region?: string;
  district?: string;
  partner?: string;
  partnerId?: string;
  cohort?: string;
  cohortId?: string;
  programType?: string;
  educationLevel?: string;
  attendanceRate?: number;
  businessPlan?: string;
  cv?: string;
  applicationLetter?: string;
  employmentStatus?: string;
  riskFlag?: boolean;
  baselineIncome?: number;
  currentIncome?: number;
  aboveIPL?: boolean;
  hasBusiness?: boolean;
};

type PartnerOption = { id: string; name: string };
type CohortOption = {
  id: string;
  label: string;
  partnerId: string;
  year: number;
};

type YouthFormState = {
  fullName: string;
  gender: "Male" | "Female";
  partner: string;
  partnerId: string;
  programType: "In-school" | "Out-of-school";
  cohort: string;
  cohortId: string;
  enrollmentDate: string;
  dateOfBirth: string;
  district: string;
};

const MAX = { name: 100, cohort: 60, partner: 150 };

const emptyForm = (): YouthFormState => ({
  fullName: "",
  gender: "Female",
  partner: "",
  partnerId: "",
  programType: "In-school",
  cohort: "",
  cohortId: "",
  enrollmentDate: new Date().toISOString().slice(0, 10),
  dateOfBirth: "",
  district: "",
});

function normalizeYouth(item: any): YouthData {
  return {
    id: String(item.id ?? item.youth_id ?? ""),
    fullName: item.full_name || item.fullName || "Unknown",
    dob: item.date_of_birth || item.dob || "",
    gender: item.gender || "Female",
    region: item.region || "",
    district: item.district || item.district_of_residence || "",
    partner: item.partner_name || item.partner || "",
    partnerId: String(item.partner_institution_id ?? ""),
    cohort: item.cohort_name || item.cohort || "",
    cohortId: String(item.cohort_id ?? ""),
    programType: item.program_type || item.programType || "In-school",
    educationLevel: item.education_level || item.educationLevel || "",
    attendanceRate: Number(item.attendance_rate ?? item.attendanceRate ?? 0),
    businessPlan:
      item.business_plan_status || item.businessPlan || "Not Started",
    cv: item.cv_status || item.cv || "Not Started",
    applicationLetter:
      item.application_letter_status || item.applicationLetter || "Not Started",
    employmentStatus:
      item.employment_status || item.employmentStatus || "Unemployed",
    riskFlag: Boolean(item.risk_flag ?? item.riskFlag ?? false),
    baselineIncome: Number(item.baseline_income ?? item.baselineIncome ?? 0),
    currentIncome: Number(item.current_income ?? item.currentIncome ?? 0),
    aboveIPL: Boolean(item.above_ipl ?? item.aboveIPL ?? false),
    hasBusiness: Boolean(item.has_business ?? item.hasBusiness ?? false),
  };
}

function buildPartnerOptions(
  partnerRows: any[],
  cohortRows: any[],
): PartnerOption[] {
  const map = new Map<string, PartnerOption>();
  for (const row of partnerRows) {
    const id = String(row.id ?? row.partner_id ?? "");
    if (!id) continue;
    map.set(id, {
      id,
      name: String(row.name || row.partner_name || row.partner || "Partner"),
    });
  }
  for (const row of cohortRows) {
    const id = String(row.partner_institution_id ?? row.partnerId ?? "");
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: String(row.partner_name || row.partnerName || "Assigned partner"),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function buildCohortOptions(rows: any[]): CohortOption[] {
  return rows.map((cohort) => ({
    id: String(cohort.id),
    label:
      cohort.label ||
      (cohort.partner_name
        ? `Cohort ${cohort.program_year} — ${cohort.partner_name}`
        : `Cohort ${cohort.program_year ?? cohort.year}`),
    partnerId: String(cohort.partner_institution_id ?? cohort.partnerId ?? ""),
    year: Number(cohort.program_year ?? cohort.year ?? 0),
  }));
}

function pickDefaults(
  partners: PartnerOption[],
  cohorts: CohortOption[],
): Partial<YouthFormState> {
  if (partners.length === 0) return {};
  const firstPartner = partners[0];
  const matching = cohorts.filter((c) => c.partnerId === firstPartner.id);
  return {
    partner: firstPartner.name,
    partnerId: firstPartner.id,
    cohort: matching[0]?.label ?? "",
    cohortId: matching[0]?.id ?? "",
  };
}

function MilestoneIndicator({ status }: { status: string }) {
  const colors = {
    Completed: "bg-success",
    "In Progress": "bg-warning",
    "Not Started": "bg-muted",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status as keyof typeof colors] || "bg-muted"}`}
      title={status}
    />
  );
}

function YouthFormFields({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  partners,
  filteredCohorts,
}: {
  form: YouthFormState;
  setForm: React.Dispatch<React.SetStateAction<YouthFormState>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  partners: PartnerOption[];
  filteredCohorts: CohortOption[];
}) {
  return (
    <div className="space-y-4">
      <FormSection theme="youth" title="Personal details">
        <div>
          <Label htmlFor="youth-name">Full Name</Label>
          <Input
            id="youth-name"
            value={form.fullName}
            onChange={(e) => {
              setForm({ ...form, fullName: e.target.value });
              setFieldErrors((prev) => ({ ...prev, fullName: "" }));
            }}
            placeholder="Alice Wanjiru"
            className="bg-white/80"
          />
          <FormFieldError message={fieldErrors.fullName} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="youth-dob">Date of Birth</Label>
            <Input
              id="youth-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => {
                setForm({ ...form, dateOfBirth: e.target.value });
                setFieldErrors((prev) => ({ ...prev, dateOfBirth: "" }));
              }}
              className="bg-white/80"
            />
            <FormFieldError message={fieldErrors.dateOfBirth} />
          </div>
          <div>
            <Label htmlFor="youth-district">District</Label>
            <Input
              id="youth-district"
              value={form.district}
              onChange={(e) => {
                setForm({ ...form, district: e.target.value });
                setFieldErrors((prev) => ({ ...prev, district: "" }));
              }}
              placeholder="Mukono"
              className="bg-white/80"
            />
            <FormFieldError message={fieldErrors.district} />
          </div>
        </div>
        <div>
          <Label htmlFor="youth-gender">Gender</Label>
          <select
            id="youth-gender"
            value={form.gender}
            onChange={(e) =>
              setForm({
                ...form,
                gender: e.target.value as "Male" | "Female",
              })
            }
            className={formSelectClass}
          >
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
        </div>
      </FormSection>

      <FormSection theme="youth" title="Program assignment">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="youth-partner">Partner Institution</Label>
            {partners.length > 0 ? (
              <Select
                value={form.partnerId || undefined}
                onValueChange={(value) => {
                  const sel = partners.find((p) => p.id === value);
                  setForm({
                    ...form,
                    partner: sel?.name ?? "",
                    partnerId: value,
                    cohort: "",
                    cohortId: "",
                  });
                  setFieldErrors((prev) => ({ ...prev, partner: "" }));
                }}
              >
                <SelectTrigger id="youth-partner" className="bg-white/80">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 bg-white/50">
                No partners assigned to your account yet. Contact your program
                manager.
              </p>
            )}
            <FormFieldError message={fieldErrors.partner} />
          </div>
          <div>
            <Label htmlFor="youth-program">Program Type</Label>
            <Select
              value={form.programType}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  programType: value as "In-school" | "Out-of-school",
                })
              }
            >
              <SelectTrigger id="youth-program" className="bg-white/80">
                <SelectValue placeholder="Select program type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In-school">In-school</SelectItem>
                <SelectItem value="Out-of-school">Out-of-school</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="youth-cohort">Cohort</Label>
            {filteredCohorts.length > 0 ? (
              <Select
                value={form.cohortId || undefined}
                onValueChange={(value) => {
                  const selected = filteredCohorts.find((c) => c.id === value);
                  setForm({
                    ...form,
                    cohortId: value,
                    cohort: selected?.label ?? form.cohort,
                  });
                  setFieldErrors((prev) => ({ ...prev, cohort: "" }));
                }}
              >
                <SelectTrigger id="youth-cohort" className="bg-white/80">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 bg-white/50">
                {form.partnerId
                  ? "No cohorts for this partner."
                  : "Select a partner first."}
              </p>
            )}
            <FormFieldError message={fieldErrors.cohort} />
          </div>
          <div>
            <Label htmlFor="youth-enroll-date">Enrollment Date</Label>
            <Input
              id="youth-enroll-date"
              type="date"
              value={form.enrollmentDate}
              onChange={(e) =>
                setForm({ ...form, enrollmentDate: e.target.value })
              }
              className="bg-white/80"
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

export default function Youth() {
  const { isProgramManager, isYBF, user } = useUser();
  const [filter, setFilter] = useState<"all" | "at-risk">("all");
  const [youthList, setYouthList] = useState<YouthData[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loadingYouth, setLoadingYouth] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingYouth, setEditingYouth] = useState<YouthData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<YouthData | null>(null);
  const [form, setForm] = useState<YouthFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canEnroll = isProgramManager() || isYBF();
  const canEdit = isProgramManager() || isYBF();
  const canDelete = isProgramManager() || user?.role === "admin";

  const reloadData = async () => {
    const [youthRows, partnerRows, cohortRows] = await Promise.all([
      getYouth(),
      getPartners(),
      getCohorts(),
    ]);
    const cohortOptions = buildCohortOptions(
      Array.isArray(cohortRows) ? cohortRows : [],
    );
    const partnerOptions = buildPartnerOptions(
      Array.isArray(partnerRows) ? partnerRows : [],
      Array.isArray(cohortRows) ? cohortRows : [],
    );
    setYouthList(
      Array.isArray(youthRows) ? youthRows.map(normalizeYouth) : [],
    );
    setCohorts(cohortOptions);
    setPartners(partnerOptions);
    return { partnerOptions, cohortOptions };
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingYouth(true);
        const { partnerOptions, cohortOptions } = await reloadData();
        if (!mounted) return;
        setForm((prev) => ({ ...prev, ...pickDefaults(partnerOptions, cohortOptions) }));
      } catch (err) {
        console.error("Failed to load youth data", err);
        if (mounted) {
          setYouthList([]);
          setPartners([]);
          setCohorts([]);
        }
      } finally {
        if (mounted) setLoadingYouth(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    setForm({ ...emptyForm(), ...pickDefaults(partners, cohorts) });
    setFieldErrors({});
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen || partners.length === 0) return;
    setForm((prev) => {
      if (prev.partnerId && partners.some((p) => p.id === prev.partnerId)) {
        return prev;
      }
      return { ...prev, ...pickDefaults(partners, cohorts) };
    });
  }, [addOpen, partners, cohorts]);

  const filteredCohorts = useMemo(
    () => cohorts.filter((cohort) => cohort.partnerId === form.partnerId),
    [cohorts, form.partnerId],
  );

  useEffect(() => {
    if (!form.partnerId || filteredCohorts.length === 0) {
      if (form.cohortId) {
        setForm((prev) => ({ ...prev, cohortId: "", cohort: "" }));
      }
      return;
    }
    if (!filteredCohorts.some((c) => c.id === form.cohortId)) {
      setForm((prev) => ({
        ...prev,
        cohort: filteredCohorts[0].label,
        cohortId: filteredCohorts[0].id,
      }));
    }
  }, [form.partnerId, filteredCohorts]);

  const validateYouthForm = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName?.trim()) errs.fullName = "Full name is required";
    if (form.fullName && form.fullName.length > MAX.name)
      errs.fullName = `Full name must be ≤ ${MAX.name} chars`;
    if (!form.partnerId && !form.partner?.trim())
      errs.partner = "Partner is required";
    if (!form.cohortId && !form.cohort?.trim())
      errs.cohort = "Cohort is required";
    if (!form.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!form.district?.trim()) errs.district = "District is required";
    return errs;
  };

  const formValid = Object.keys(validateYouthForm()).length === 0;

  const filtered = youthList.filter((y) =>
    filter === "at-risk" ? y.riskFlag : true,
  );

  const atRisk = youthList.filter((y) => y.riskFlag).length;
  const inWork = youthList.filter(
    (y) => !y.employmentStatus?.includes("Unemployed"),
  ).length;

  const buildPayload = () => {
    const normalizedProgramType =
      form.programType === "Out-of-school" ? "Out-of-school" : "In-school";
    const payload: Record<string, string> = {
      full_name: form.fullName,
      date_of_birth: form.dateOfBirth,
      gender: form.gender,
      district: form.district,
      program_type: normalizedProgramType,
      programType: normalizedProgramType,
    };
    if (form.partnerId) payload.partner_institution_id = form.partnerId;
    if (form.cohortId) payload.cohort_id = form.cohortId;
    return payload;
  };

  const handleEnroll = async () => {
    const errs = validateYouthForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    try {
      const created = await createYouth(buildPayload());
      setYouthList((prev) => [
        normalizeYouth({
          ...created,
          partner_name: created.partner_name || form.partner,
          cohort_name: created.cohort_name || form.cohort,
        }),
        ...prev,
      ]);
      setAddOpen(false);
      setForm({ ...emptyForm(), ...pickDefaults(partners, cohorts) });
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to create youth" });
    }
  };

  const openEdit = (y: YouthData) => {
    setEditingYouth(y);
    setForm({
      fullName: y.fullName,
      gender: (y.gender as "Male" | "Female") || "Female",
      partner: y.partner || "",
      partnerId: y.partnerId || partners.find((p) => p.name === y.partner)?.id || "",
      programType:
        (y.programType === "Out-of-school"
          ? "Out-of-school"
          : "In-school") as "In-school" | "Out-of-school",
      cohort: y.cohort || "",
      cohortId: y.cohortId || cohorts.find((c) => c.label === y.cohort)?.id || "",
      enrollmentDate: new Date().toISOString().slice(0, 10),
      dateOfBirth: y.dob || "",
      district: y.district || "",
    });
    setFieldErrors({});
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingYouth) return;
    const errs = validateYouthForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    try {
      const updated = await updateYouth(editingYouth.id, buildPayload());
      setYouthList((prev) =>
        prev.map((y) =>
          y.id === editingYouth.id
            ? normalizeYouth({
                ...updated,
                partner_name: form.partner,
                cohort_name: form.cohort,
                attendance_rate: y.attendanceRate,
                risk_flag: y.riskFlag,
              })
            : y,
        ),
      );
      setEditOpen(false);
      setEditingYouth(null);
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to update youth" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteYouth(deleteTarget.id);
      setYouthList((prev) => prev.filter((y) => y.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to delete youth" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Youth Enrollment & Profiling</h1>
          <p className="page-description">
            Manage youth registration and baseline data
          </p>
        </div>
        {canEnroll && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1" /> Enroll Youth
              </Button>
            </DialogTrigger>
            <FormDialogShell
              theme="youth"
              icon={UserPlus}
              title="Enroll New Youth"
              subtitle="Register a youth participant in your assigned cohort"
            >
              <YouthFormFields
                form={form}
                setForm={setForm}
                fieldErrors={fieldErrors}
                setFieldErrors={setFieldErrors}
                partners={partners}
                filteredCohorts={filteredCohorts}
              />
              <FormFieldError message={fieldErrors.submit} />
              <FormActions
                theme="youth"
                onCancel={() => setAddOpen(false)}
                onSubmit={handleEnroll}
                submitLabel="Enroll Youth"
                disabled={!formValid || partners.length === 0}
              />
            </FormDialogShell>
          </Dialog>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <FormDialogShell
          theme="youth"
          icon={Edit3}
          title="Edit Youth Record"
          subtitle={editingYouth ? editingYouth.fullName : ""}
        >
          <YouthFormFields
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            partners={partners}
            filteredCohorts={filteredCohorts}
          />
          <FormFieldError message={fieldErrors.submit} />
          <FormActions
            theme="youth"
            onCancel={() => {
              setEditOpen(false);
              setEditingYouth(null);
            }}
            onSubmit={handleUpdate}
            submitLabel="Save Changes"
            disabled={!formValid}
          />
        </FormDialogShell>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete youth record?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteTarget?.fullName} from the system? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Youth"
          value={youthList.length}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="At Risk (<80%)"
          value={atRisk}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="In Work"
          value={inWork}
          subtitle={`${Math.round(inWork / Math.max(youthList.length, 1))}% of total`}
          icon={Briefcase}
          variant="success"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "at-risk" ? "destructive" : "outline"}
          size="sm"
          onClick={() => setFilter("at-risk")}
        >
          At Risk
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Outputs</TableHead>
                <TableHead>Employment</TableHead>
                <TableHead>Risk</TableHead>
                {(canEdit || canDelete) && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingYouth ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit || canDelete ? 9 : 8}
                    className="text-center py-10 text-muted-foreground"
                  >
                    Loading youth records…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit || canDelete ? 9 : 8}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No youth records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((y) => (
                  <TableRow key={y.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{y.fullName}</TableCell>
                    <TableCell>{y.gender}</TableCell>
                    <TableCell>{y.partner}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{y.programType}</Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          (y.attendanceRate ?? 0) < 80
                            ? "text-destructive font-semibold"
                            : "font-semibold"
                        }
                      >
                        {y.attendanceRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 items-center">
                        <MilestoneIndicator status={y.businessPlan || "Not Started"} />
                        <MilestoneIndicator status={y.cv || "Not Started"} />
                        <MilestoneIndicator
                          status={y.applicationLetter || "Not Started"}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          y.employmentStatus?.includes("Unemployed")
                            ? "destructive"
                            : "default"
                        }
                      >
                        {y.employmentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {y.riskFlag && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => openEdit(y)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(y)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
