import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Users, Edit3, UserPlus } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  createYouth,
  getCohorts,
  getPartners,
  getYouth,
  updateYouth,
} from "@/api";
import { REGIONS } from "@/constants/regions";
import {
  FormActions,
  FormDialogShell,
  FormFieldError,
  FormSection,
  formSelectClass,
} from "@/components/FormDialogShell";

type PartnerOption = { id: string; name: string };
type CohortOption = {
  id: string;
  label: string;
  partnerId: string;
  year: number;
};

type YearOneForm = {
  fullName: string;
  gender: "Male" | "Female";
  dateOfBirth: string;
  district: string;
  nationality: string;
  disability: string;
  course: string;
  employmentStatus: string;
  partnerId: string;
  cohortId: string;
  programType: "In-school" | "Out-of-school";
  region: string;
};

type YearTwoForm = {
  youthId: string;
  schoolName: string;
};

const emptyYearOne = (): YearOneForm => ({
  fullName: "",
  gender: "Female",
  dateOfBirth: "",
  district: "",
  nationality: "Ugandan",
  disability: "None",
  course: "",
  employmentStatus: "Unemployed",
  partnerId: "",
  cohortId: "",
  programType: "In-school",
  region: REGIONS[0],
});

export default function YBFYouthRoster() {
  const [tab, setTab] = useState<"year1" | "year2">("year1");
  const [youthList, setYouthList] = useState<any[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [yearTwoOpen, setYearTwoOpen] = useState(false);
  const [yearOneForm, setYearOneForm] = useState<YearOneForm>(emptyYearOne);
  const [yearTwoForm, setYearTwoForm] = useState<YearTwoForm>({
    youthId: "",
    schoolName: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const rosterYear = tab === "year1" ? 1 : 2;
  const filteredYouth = useMemo(
    () =>
      youthList.filter((y) => Number(y.roster_year ?? y.rosterYear ?? 1) === rosterYear),
    [youthList, rosterYear],
  );

  const yearOneYouth = useMemo(
    () => youthList.filter((y) => Number(y.roster_year ?? 1) === 1),
    [youthList],
  );

  const filteredCohorts = useMemo(
    () => cohorts.filter((c) => c.partnerId === yearOneForm.partnerId),
    [cohorts, yearOneForm.partnerId],
  );

  const reload = async () => {
    const [youthRows, partnerRows, cohortRows] = await Promise.all([
      getYouth(),
      getPartners(),
      getCohorts(),
    ]);
    setYouthList(Array.isArray(youthRows) ? youthRows : []);
    setPartners(
      (Array.isArray(partnerRows) ? partnerRows : []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
      })),
    );
    setCohorts(
      (Array.isArray(cohortRows) ? cohortRows : []).map((c: any) => ({
        id: String(c.id),
        label:
          c.label ||
          (c.partner_name
            ? `Cohort ${c.program_year} — ${c.partner_name}`
            : `Cohort ${c.program_year}`),
        partnerId: String(c.partner_institution_id ?? ""),
        year: Number(c.program_year ?? 0),
      })),
    );
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await reload();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!addOpen || partners.length === 0) return;
    setYearOneForm((prev) => ({
      ...prev,
      partnerId: prev.partnerId || partners[0].id,
      cohortId:
        prev.cohortId ||
        cohorts.find((c) => c.partnerId === (prev.partnerId || partners[0].id))
          ?.id ||
        "",
    }));
  }, [addOpen, partners, cohorts]);

  const handleYearOneSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!yearOneForm.fullName.trim()) errs.fullName = "Full name is required";
    if (!yearOneForm.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!yearOneForm.district.trim()) errs.district = "District is required";
    if (!yearOneForm.partnerId) errs.partner = "Partner is required";
    if (!yearOneForm.cohortId) errs.cohort = "Cohort is required";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    try {
      await createYouth({
        full_name: yearOneForm.fullName,
        date_of_birth: yearOneForm.dateOfBirth,
        gender: yearOneForm.gender,
        district: yearOneForm.district,
        partner_institution_id: yearOneForm.partnerId,
        cohort_id: yearOneForm.cohortId,
        program_type: yearOneForm.programType,
        nationality: yearOneForm.nationality,
        region: yearOneForm.region,
        disability: yearOneForm.disability,
        course: yearOneForm.course,
        employment_status: yearOneForm.employmentStatus,
        roster_year: 1,
      });
      setAddOpen(false);
      setYearOneForm(emptyYearOne());
      await reload();
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to save youth" });
    }
  };

  const handleYearTwoSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!yearTwoForm.youthId) errs.youthId = "Select a youth from Year One";
    if (!yearTwoForm.schoolName.trim()) errs.schoolName = "School name is required";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    try {
      const selected = yearOneYouth.find(
        (y) => String(y.id) === String(yearTwoForm.youthId),
      );
      if (!selected) throw new Error("Youth not found");
      await updateYouth(String(selected.id), {
        full_name: selected.full_name || selected.fullName,
        date_of_birth: selected.date_of_birth || selected.dob,
        gender: selected.gender,
        district: selected.district || selected.district_of_residence,
        partner_institution_id: selected.partner_institution_id || selected.partnerId,
        cohort_id: selected.cohort_id || selected.cohortId,
        program_type: selected.program_type || selected.programType,
        school_name: yearTwoForm.schoolName,
        roster_year: 2,
      });
      setYearTwoOpen(false);
      setYearTwoForm({ youthId: "", schoolName: "" });
      await reload();
    } catch (err: any) {
      setFieldErrors({ submit: err?.message || "Failed to update youth" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Youth Roster</h1>
          <p className="page-description">
            Manage Year One intake and Year Two school placements
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "year1" | "year2")}>
        <TabsList>
          <TabsTrigger value="year1">Year One</TabsTrigger>
          <TabsTrigger value="year2">Year Two</TabsTrigger>
        </TabsList>

        <TabsContent value="year1" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" /> Add Year One Youth
                </Button>
              </DialogTrigger>
              <FormDialogShell
                theme="youth"
                icon={UserPlus}
                title="Year One — Youth Intake"
                subtitle="Register a new youth with baseline profiling data"
              >
                <FormSection theme="youth" title="Personal details">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={yearOneForm.fullName}
                      onChange={(e) =>
                        setYearOneForm({ ...yearOneForm, fullName: e.target.value })
                      }
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.fullName} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={yearOneForm.dateOfBirth}
                        onChange={(e) =>
                          setYearOneForm({
                            ...yearOneForm,
                            dateOfBirth: e.target.value,
                          })
                        }
                        className="bg-white/80"
                      />
                      <FormFieldError message={fieldErrors.dateOfBirth} />
                    </div>
                    <div>
                      <Label>District</Label>
                      <Input
                        value={yearOneForm.district}
                        onChange={(e) =>
                          setYearOneForm({ ...yearOneForm, district: e.target.value })
                        }
                        className="bg-white/80"
                      />
                      <FormFieldError message={fieldErrors.district} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Gender</Label>
                      <select
                        value={yearOneForm.gender}
                        onChange={(e) =>
                          setYearOneForm({
                            ...yearOneForm,
                            gender: e.target.value as "Male" | "Female",
                          })
                        }
                        className={formSelectClass}
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                    <div>
                      <Label>Nationality</Label>
                      <Input
                        value={yearOneForm.nationality}
                        onChange={(e) =>
                          setYearOneForm({
                            ...yearOneForm,
                            nationality: e.target.value,
                          })
                        }
                        className="bg-white/80"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Disability</Label>
                      <Input
                        value={yearOneForm.disability}
                        onChange={(e) =>
                          setYearOneForm({
                            ...yearOneForm,
                            disability: e.target.value,
                          })
                        }
                        placeholder="None / specify"
                        className="bg-white/80"
                      />
                    </div>
                    <div>
                      <Label>Course</Label>
                      <Input
                        value={yearOneForm.course}
                        onChange={(e) =>
                          setYearOneForm({ ...yearOneForm, course: e.target.value })
                        }
                        className="bg-white/80"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Employment Status</Label>
                    <select
                      value={yearOneForm.employmentStatus}
                      onChange={(e) =>
                        setYearOneForm({
                          ...yearOneForm,
                          employmentStatus: e.target.value,
                        })
                      }
                      className={formSelectClass}
                    >
                      <option value="Unemployed">Unemployed</option>
                      <option value="Self-employed">Self-employed</option>
                      <option value="Employed">Employed</option>
                      <option value="Student">Student</option>
                    </select>
                  </div>
                </FormSection>
                <FormSection theme="youth" title="Program assignment">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Partner Institution</Label>
                      <Select
                        value={yearOneForm.partnerId || undefined}
                        onValueChange={(value) =>
                          setYearOneForm({
                            ...yearOneForm,
                            partnerId: value,
                            cohortId: "",
                          })
                        }
                      >
                        <SelectTrigger className="bg-white/80">
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={fieldErrors.partner} />
                    </div>
                    <div>
                      <Label>Program Type</Label>
                      <Select
                        value={yearOneForm.programType}
                        onValueChange={(value) =>
                          setYearOneForm({
                            ...yearOneForm,
                            programType: value as "In-school" | "Out-of-school",
                          })
                        }
                      >
                        <SelectTrigger className="bg-white/80">
                          <SelectValue />
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
                      <Label>Region</Label>
                      <Select
                        value={yearOneForm.region}
                        onValueChange={(value) =>
                          setYearOneForm({ ...yearOneForm, region: value })
                        }
                      >
                        <SelectTrigger className="bg-white/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cohort</Label>
                      <Select
                        value={yearOneForm.cohortId || undefined}
                        onValueChange={(value) =>
                          setYearOneForm({ ...yearOneForm, cohortId: value })
                        }
                      >
                        <SelectTrigger className="bg-white/80">
                          <SelectValue placeholder="Select cohort" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCohorts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormFieldError message={fieldErrors.cohort} />
                    </div>
                  </div>
                </FormSection>
                <FormFieldError message={fieldErrors.submit} />
                <FormActions
                  theme="youth"
                  onCancel={() => setAddOpen(false)}
                  onSubmit={handleYearOneSubmit}
                  submitLabel="Save Year One Record"
                />
              </FormDialogShell>
            </Dialog>
          </div>

          <YouthTable
            rows={filteredYouth}
            loading={loading}
            columns={[
              "name",
              "nationality",
              "disability",
              "course",
              "employment",
              "region",
              "partner",
            ]}
          />
        </TabsContent>

        <TabsContent value="year2" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={yearTwoOpen} onOpenChange={setYearTwoOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit3 className="h-4 w-4 mr-1" /> Record School Placement
                </Button>
              </DialogTrigger>
              <FormDialogShell
                theme="youth"
                icon={Edit3}
                title="Year Two — School Placement"
                subtitle="Enter the school name for a Year One youth"
              >
                <div className="space-y-4">
                  <div>
                    <Label>Youth (from Year One)</Label>
                    <select
                      value={yearTwoForm.youthId}
                      onChange={(e) =>
                        setYearTwoForm({ ...yearTwoForm, youthId: e.target.value })
                      }
                      className={formSelectClass}
                    >
                      <option value="">Select youth</option>
                      {yearOneYouth.map((y) => (
                        <option key={y.id} value={String(y.id)}>
                          {y.full_name || y.fullName}
                        </option>
                      ))}
                    </select>
                    <FormFieldError message={fieldErrors.youthId} />
                  </div>
                  <div>
                    <Label>School</Label>
                    <Input
                      value={yearTwoForm.schoolName}
                      onChange={(e) =>
                        setYearTwoForm({ ...yearTwoForm, schoolName: e.target.value })
                      }
                      placeholder="Enter school name"
                      className="bg-white/80"
                    />
                    <FormFieldError message={fieldErrors.schoolName} />
                  </div>
                </div>
                <FormFieldError message={fieldErrors.submit} />
                <FormActions
                  theme="youth"
                  onCancel={() => setYearTwoOpen(false)}
                  onSubmit={handleYearTwoSubmit}
                  submitLabel="Save School"
                />
              </FormDialogShell>
            </Dialog>
          </div>

          <YouthTable
            rows={filteredYouth}
            loading={loading}
            columns={["name", "school", "partner"]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function YouthTable({
  rows,
  loading,
  columns,
}: {
  rows: any[];
  loading: boolean;
  columns: string[];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {columns.includes("nationality") && <TableHead>Nationality</TableHead>}
              {columns.includes("disability") && <TableHead>Disability</TableHead>}
              {columns.includes("course") && <TableHead>Course</TableHead>}
              {columns.includes("employment") && <TableHead>Employment</TableHead>}
              {columns.includes("region") && <TableHead>Region</TableHead>}
              {columns.includes("school") && <TableHead>School</TableHead>}
              {columns.includes("partner") && <TableHead>Partner</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No records for this year.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">
                    {y.full_name || y.fullName}
                  </TableCell>
                  {columns.includes("nationality") && (
                    <TableCell>{y.nationality || "—"}</TableCell>
                  )}
                  {columns.includes("disability") && (
                    <TableCell>{y.disability || "—"}</TableCell>
                  )}
                  {columns.includes("course") && (
                    <TableCell>{y.course || "—"}</TableCell>
                  )}
                  {columns.includes("employment") && (
                    <TableCell>
                      <Badge variant="secondary">
                        {y.employment_status || y.employmentStatus || "—"}
                      </Badge>
                    </TableCell>
                  )}
                  {columns.includes("region") && (
                    <TableCell>{y.region || y.partner_region || "—"}</TableCell>
                  )}
                  {columns.includes("school") && (
                    <TableCell>{y.school_name || y.schoolName || "—"}</TableCell>
                  )}
                  {columns.includes("partner") && (
                    <TableCell>{y.partner_name || y.partner || "—"}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
