import { useEffect, useState } from "react";
import {
  getPartners,
  getPersonnel,
  createPartner,
  createPersonnel,
  updatePartner,
  deletePartner,
  updatePersonnel,
  deletePersonnel,
} from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building2,
  Plus,
  Users,
  UserCheck,
  Phone,
  Mail,
  Edit3,
  Trash2,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useUser } from "@/hooks/use-user";

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
  assignedYBF: string;
};

type Personnel = {
  id: string;
  name: string;
  role: string;
  email: string;
  contact: string;
  assignedTo: string;
  details: string;
  status: string;
};

type PersonnelForm = {
  name: string;
  role: "YBF" | "Instructor" | "Enumerator";
  contact: string;
  email: string;
  assignedTo: string;
  programYearStart: string;
  subjectArea: string;
  geographicArea: string;
  status: "Active" | "Inactive";
};

const defaultPersonnelForm: PersonnelForm = {
  name: "",
  role: "YBF",
  contact: "",
  email: "",
  assignedTo: "",
  programYearStart: "",
  subjectArea: "",
  geographicArea: "",
  status: "Active",
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
};

const PHONE_RE = /^\+?[0-9 \-]{7,20}$/;
const MAX = {
  name: 100,
  district: 100,
  location: 150,
  contactName: 100,
  contactPhone: 20,
  contactEmail: 150,
};

const normalizeRole = (role: string | undefined | null) => {
  if (!role) return "Staff";
  const normalized = role.toString().trim().toLowerCase();
  if (normalized === "ybf") return "YBF";
  if (normalized === "administrator" || normalized === "admin") return "Admin";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizePartner = (partner: any): Partner => ({
  id: partner.id,
  name: partner.name || "Unknown institution",
  type: (partner.type || partner.institution_type || "TVET")
    .toString()
    .toUpperCase(),
  location: partner.location || partner.location || "-",
  district: partner.district || "-",
  contactName: partner.contact_name || "-",
  contactPhone: partner.contact_phone || "-",
  contactEmail: partner.contact_email || "-",
  status: partner.status || "Active",
  startDate: partner.partnership_date || partner.created_at || "",
  cohortsCount: partner.cohorts_count ?? 0,
  assignedYBF: partner.assignedYBF || "-",
});

const normalizePersonnel = (person: any): Personnel => ({
  id: person.id,
  name: person.name || "Unknown staff",
  role: normalizeRole(person.role),
  email: person.email || "-",
  contact: person.email || "-",
  assignedTo: "-",
  details: person.created_at
    ? `Account created ${new Date(person.created_at).toLocaleDateString()}`
    : "No details",
  status: "Active",
});

export default function Partners() {
  const { isProgramManager, isYBF, user } = useUser();
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [personnelFormError, setPersonnelFormError] = useState<string | null>(
    null,
  );
  const [partnerFieldErrors, setPartnerFieldErrors] = useState<
    Record<string, string>
  >({});
  const [personnelFieldErrors, setPersonnelFieldErrors] = useState<
    Record<string, string>
  >({});
  const [partners, setPartners] = useState<Partner[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [partnerAddOpen, setPartnerAddOpen] = useState(false);
  const [personnelAddOpen, setPersonnelAddOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState(defaultPartnerForm);
  const [personnelForm, setPersonnelForm] =
    useState<PersonnelForm>(defaultPersonnelForm);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "partner" | "personnel";
    id: string;
    name: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAddPartner = isProgramManager() || isYBF();
  const canEditPartner = isProgramManager() || user?.role === "admin";
  const canDeletePartner = user?.role === "admin";
  const canManagePersonnel = isProgramManager() || user?.role === "admin";

  useEffect(() => {
    const loadBackendData = async () => {
      try {
        setLoading(true);
        const [partnerRows, personnelRows] = await Promise.all([
          getPartners(),
          getPersonnel(),
        ]);
        setPartners(partnerRows.map(normalizePartner));
        setPersonnel(personnelRows.map(normalizePersonnel));
      } catch (err: any) {
        setError(err?.message || "Failed to load partner or personnel data.");
      } finally {
        setLoading(false);
      }
    };

    loadBackendData();
  }, []);

  useEffect(() => {
    if (!partnerAddOpen) {
      setPartnerFormError(null);
      setPartnerFieldErrors({});
      setEditingPartner(null);
      setPartnerForm(defaultPartnerForm);
    }
    if (!personnelAddOpen) {
      setPersonnelFormError(null);
      setPersonnelFieldErrors({});
      setEditingPersonnel(null);
      setPersonnelForm(defaultPersonnelForm);
    }
  }, [partnerAddOpen, personnelAddOpen]);

  const validatePartnerForm = () => {
    const errs: Record<string, string> = {};
    if (!partnerForm.name || !partnerForm.name.trim())
      errs.name = "Institution name is required";
    if (partnerForm.name && partnerForm.name.length > MAX.name)
      errs.name = `Institution name must be ≤ ${MAX.name} chars`;
    if (!partnerForm.district || !partnerForm.district.trim())
      errs.district = "District is required";
    if (partnerForm.district && partnerForm.district.length > MAX.district)
      errs.district = `District must be ≤ ${MAX.district} chars`;
    if (!partnerForm.type) errs.type = "Partner type is required";
    if (partnerForm.location && partnerForm.location.length > MAX.location)
      errs.location = `Location must be ≤ ${MAX.location} chars`;
    if (
      partnerForm.contactName &&
      partnerForm.contactName.length > MAX.contactName
    )
      errs.contactName = `Contact name must be ≤ ${MAX.contactName} chars`;
    if (
      partnerForm.contactPhone &&
      partnerForm.contactPhone.length > MAX.contactPhone
    )
      errs.contactPhone = `Phone must be ≤ ${MAX.contactPhone} chars`;
    if (partnerForm.contactPhone && !PHONE_RE.test(partnerForm.contactPhone))
      errs.contactPhone = "Contact phone is invalid";
    if (
      partnerForm.contactEmail &&
      !/^\S+@\S+\.\S+$/.test(partnerForm.contactEmail)
    )
      errs.contactEmail = "Contact email is invalid";
    return errs;
  };

  const validatePersonnelForm = () => {
    const errs: Record<string, string> = {};
    if (!personnelForm.name || !personnelForm.name.trim())
      errs.name = "Name is required";
    if (personnelForm.name && personnelForm.name.length > MAX.name)
      errs.name = `Name must be ≤ ${MAX.name} chars`;
    if (!personnelForm.email || !personnelForm.email.trim())
      errs.email = "Email is required";
    if (personnelForm.email && !/^\S+@\S+\.\S+$/.test(personnelForm.email))
      errs.email = "Email is invalid";
    if (
      personnelForm.contact &&
      personnelForm.contact.length > MAX.contactPhone
    )
      errs.contact = `Phone must be ≤ ${MAX.contactPhone} chars`;
    if (personnelForm.contact && !PHONE_RE.test(personnelForm.contact))
      errs.contact = "Phone is invalid";
    if (!personnelForm.role) errs.role = "Role is required";
    return errs;
  };

  const partnerFormValid = Object.keys(validatePartnerForm()).length === 0;
  const personnelFormValid = Object.keys(validatePersonnelForm()).length === 0;

  const filteredPartners = partners;
  const filteredPersonnel = personnel;
  const partnerColumnCount = 9 + (canEditPartner || canDeletePartner ? 1 : 0);
  const personnelColumnCount = 6 + (canManagePersonnel ? 1 : 0);

  const openEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    setPartnerForm({
      name: partner.name,
      type: partner.type as "TVET" | "CBO",
      location: partner.location,
      district: partner.district,
      contactName: partner.contactName,
      contactPhone: partner.contactPhone,
      contactEmail: partner.contactEmail,
      status: partner.status as "Active" | "Inactive",
      startDate: partner.startDate
        ? new Date(partner.startDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
    setPartnerAddOpen(true);
  };

  const openEditPersonnel = (person: Personnel) => {
    setEditingPersonnel(person);
    setPersonnelForm({
      name: person.name,
      role:
        person.role === "YBF"
          ? "YBF"
          : person.role === "Instructor"
            ? "Instructor"
            : "Enumerator",
      contact: person.contact === "-" ? "" : person.contact,
      email: person.email === "-" ? "" : person.email,
      assignedTo: person.assignedTo === "-" ? "" : person.assignedTo,
      programYearStart: "",
      subjectArea: "",
      geographicArea: "",
      status: person.status as "Active" | "Inactive",
    });
    setPersonnelAddOpen(true);
  };

  const openDeleteTarget = (
    type: "partner" | "personnel",
    id: string,
    name: string,
  ) => {
    setDeleteTarget({ type, id, name });
    setDeleteOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      if (type === "partner") {
        await deletePartner(id);
        setPartners((prev) => prev.filter((item) => item.id !== id));
      } else {
        await deletePersonnel(id);
        setPersonnel((prev) => prev.filter((item) => item.id !== id));
      }
      setDeleteTarget(null);
      setDeleteOpen(false);
    } catch (err: any) {
      setError(err?.message || `Failed to delete ${type}`);
    }
  };

  const handleSavePartner = async () => {
    try {
      const validation = validatePartnerForm();
      if (Object.keys(validation).length > 0) {
        setPartnerFieldErrors(validation);
        return;
      }

      const payload = {
        name: partnerForm.name,
        district: partnerForm.district,
        type: partnerForm.type,
        location: partnerForm.location,
        contact_name: partnerForm.contactName,
        contact_phone: partnerForm.contactPhone,
        contact_email: partnerForm.contactEmail,
        partnership_date: partnerForm.startDate,
        status: partnerForm.status,
      };

      if (editingPartner) {
        const updated = await updatePartner(editingPartner.id, payload);
        setPartners((prev) =>
          prev.map((p) =>
            p.id === updated.id ? normalizePartner(updated) : p,
          ),
        );
      } else {
        const created = await createPartner(payload);
        setPartners((prev) => [normalizePartner(created), ...prev]);
      }

      setPartnerAddOpen(false);
      setPartnerForm(defaultPartnerForm);
      setEditingPartner(null);
    } catch (err: any) {
      setError(err?.message || "Failed to save partner.");
    }
  };

  const handleSavePersonnel = async () => {
    try {
      const validation = validatePersonnelForm();
      if (Object.keys(validation).length > 0) {
        setPersonnelFieldErrors(validation);
        return;
      }

      const payload = {
        name: personnelForm.name,
        email: personnelForm.email,
        role: personnelForm.role.toLowerCase(),
      };

      if (editingPersonnel) {
        const updated = await updatePersonnel(editingPersonnel.id, payload);
        setPersonnel((prev) =>
          prev.map((p) =>
            p.id === String(updated.id)
              ? {
                  ...p,
                  name: updated.name,
                  email: updated.email,
                  contact: updated.email,
                  assignedTo: personnelForm.assignedTo || "-",
                  role: normalizeRole(updated.role),
                  details: updated.created_at
                    ? `Account created ${new Date(
                        updated.created_at,
                      ).toLocaleDateString()}`
                    : p.details,
                  status: personnelForm.status,
                }
              : p,
          ),
        );
      } else {
        const created = await createPersonnel({
          ...payload,
          assigned_to: personnelForm.assignedTo,
        });
        setPersonnel((prev) => [
          {
            id: created.id,
            name: created.name,
            role: normalizeRole(created.role),
            email: created.email,
            contact: created.email,
            assignedTo: personnelForm.assignedTo || "-",
            details: created.created_at
              ? `Account created ${new Date(created.created_at).toLocaleDateString()}`
              : "New personnel account",
            status: "Active",
          },
          ...prev,
        ]);
      }

      setPersonnelAddOpen(false);
      setPersonnelForm(defaultPersonnelForm);
      setEditingPersonnel(null);
    } catch (err: any) {
      setError(err?.message || "Failed to save personnel.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Partners & Personnel</h1>
          <p className="page-description">
            Manage institutional partners and linked program staff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManagePersonnel && (
            <Dialog open={personnelAddOpen} onOpenChange={setPersonnelAddOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="h-4 w-4 mr-1" /> Add Personnel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingPersonnel
                      ? "Edit Personnel Record"
                      : "Add Personnel Record"}
                  </DialogTitle>
                </DialogHeader>
                {personnelFormError ? (
                  <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
                    {personnelFormError}
                  </div>
                ) : null}
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="personnel-name">Name</Label>
                    <Input
                      id="personnel-name"
                      value={personnelForm.name}
                      onChange={(e) => {
                        setPersonnelForm({
                          ...personnelForm,
                          name: e.target.value,
                        });
                        setPersonnelFieldErrors({
                          ...personnelFieldErrors,
                          name: "",
                        });
                      }}
                      maxLength={MAX.name}
                      placeholder="Jane Doe"
                    />
                    {personnelFieldErrors.name && (
                      <p className="text-sm text-destructive mt-1">
                        {personnelFieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="personnel-role">Role</Label>
                      <select
                        id="personnel-role"
                        value={personnelForm.role}
                        onChange={(e) => {
                          setPersonnelForm({
                            ...personnelForm,
                            role: e.target.value as PersonnelForm["role"],
                          });
                          setPersonnelFieldErrors({
                            ...personnelFieldErrors,
                            role: "",
                          });
                        }}
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="YBF">Youth Business Fellow</option>
                        <option value="Instructor">Instructor</option>
                        <option value="Enumerator">Enumerator</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="personnel-email">Email</Label>
                      <Input
                        id="personnel-email"
                        type="email"
                        value={personnelForm.email}
                        onChange={(e) => {
                          setPersonnelForm({
                            ...personnelForm,
                            email: e.target.value,
                          });
                          setPersonnelFieldErrors({
                            ...personnelFieldErrors,
                            email: "",
                          });
                        }}
                        maxLength={MAX.contactEmail}
                        placeholder="staff@wezesha.org"
                      />
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Mail className="h-4 w-4 mr-2" />
                        <span>
                          Use a work or institutional email when available.
                        </span>
                      </div>
                      {personnelFieldErrors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {personnelFieldErrors.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="personnel-contact">Phone</Label>
                      <Input
                        id="personnel-contact"
                        value={personnelForm.contact}
                        onChange={(e) => {
                          setPersonnelForm({
                            ...personnelForm,
                            contact: e.target.value,
                          });
                          setPersonnelFieldErrors({
                            ...personnelFieldErrors,
                            contact: "",
                          });
                        }}
                        maxLength={MAX.contactPhone}
                        placeholder="+254700000000"
                      />
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Phone className="h-4 w-4 mr-2" />
                        <span>International format, e.g. +254712345678</span>
                      </div>
                      {personnelFieldErrors.contact && (
                        <p className="text-sm text-destructive mt-1">
                          {personnelFieldErrors.contact}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="personnel-assigned">Assigned To</Label>
                      <Input
                        id="personnel-assigned"
                        value={personnelForm.assignedTo}
                        onChange={(e) =>
                          setPersonnelForm({
                            ...personnelForm,
                            assignedTo: e.target.value,
                          })
                        }
                        placeholder="Institution or area"
                      />
                    </div>
                  </div>
                  {personnelForm.role === "YBF" && (
                    <div>
                      <Label htmlFor="personnel-year">Program Year Start</Label>
                      <Input
                        id="personnel-year"
                        value={personnelForm.programYearStart}
                        onChange={(e) =>
                          setPersonnelForm({
                            ...personnelForm,
                            programYearStart: e.target.value,
                          })
                        }
                        placeholder="2024"
                      />
                    </div>
                  )}
                  {personnelForm.role === "Instructor" && (
                    <div>
                      <Label htmlFor="personnel-subject">Subject Area</Label>
                      <Input
                        id="personnel-subject"
                        value={personnelForm.subjectArea}
                        onChange={(e) =>
                          setPersonnelForm({
                            ...personnelForm,
                            subjectArea: e.target.value,
                          })
                        }
                        placeholder="Business Studies"
                      />
                    </div>
                  )}
                  {personnelForm.role === "Enumerator" && (
                    <div>
                      <Label htmlFor="personnel-area">
                        Geographic Area / Cohort
                      </Label>
                      <Input
                        id="personnel-area"
                        value={personnelForm.geographicArea}
                        onChange={(e) =>
                          setPersonnelForm({
                            ...personnelForm,
                            geographicArea: e.target.value,
                          })
                        }
                        placeholder="Nairobi, Kisumu"
                      />
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="personnel-status">Status</Label>
                      <select
                        id="personnel-status"
                        value={personnelForm.status}
                        onChange={(e) =>
                          setPersonnelForm({
                            ...personnelForm,
                            status: e.target.value as PersonnelForm["status"],
                          })
                        }
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPersonnelAddOpen(false);
                          setPersonnelFieldErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSavePersonnel}
                        disabled={!personnelFormValid}
                      >
                        {editingPersonnel ? "Update" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canAddPartner && (
            <Dialog open={partnerAddOpen} onOpenChange={setPartnerAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" /> Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingPartner ? "Edit Partner" : "Add New Partner"}
                  </DialogTitle>
                </DialogHeader>
                {partnerFormError ? (
                  <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
                    {partnerFormError}
                  </div>
                ) : null}
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="partner-name">Institution Name</Label>
                    <Input
                      id="partner-name"
                      value={partnerForm.name}
                      onChange={(e) =>
                        setPartnerForm({ ...partnerForm, name: e.target.value })
                      }
                      maxLength={MAX.name}
                      placeholder="E.g. City Youth Centre"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partner-location">
                        Physical Location
                      </Label>
                      <Input
                        id="partner-location"
                        value={partnerForm.location}
                        onChange={(e) =>
                          setPartnerForm({
                            ...partnerForm,
                            location: e.target.value,
                          })
                        }
                        maxLength={MAX.location}
                        placeholder="Nairobi CBD"
                      />
                    </div>
                    <div>
                      <Label htmlFor="partner-district">District</Label>
                      <Input
                        id="partner-district"
                        value={partnerForm.district}
                        onChange={(e) =>
                          setPartnerForm({
                            ...partnerForm,
                            district: e.target.value,
                          })
                        }
                        maxLength={MAX.district}
                        placeholder="Nairobi"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partner-type">Type</Label>
                      <select
                        id="partner-type"
                        value={partnerForm.type}
                        onChange={(e) =>
                          setPartnerForm({
                            ...partnerForm,
                            type: e.target.value as "TVET" | "CBO",
                          })
                        }
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="TVET">TVET</option>
                        <option value="CBO">CBO</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="partner-status">Status</Label>
                      <select
                        id="partner-status"
                        value={partnerForm.status}
                        onChange={(e) =>
                          setPartnerForm({
                            ...partnerForm,
                            status: e.target.value as "Active" | "Inactive",
                          })
                        }
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partner-contact">Contact Name</Label>
                      <Input
                        id="partner-contact"
                        value={partnerForm.contactName}
                        onChange={(e) => {
                          setPartnerForm({
                            ...partnerForm,
                            contactName: e.target.value,
                          });
                          setPartnerFieldErrors({
                            ...partnerFieldErrors,
                            contactName: "",
                          });
                        }}
                        maxLength={MAX.contactName}
                        placeholder="James Mwangi"
                      />
                      {partnerFieldErrors.contactName && (
                        <p className="text-sm text-destructive mt-1">
                          {partnerFieldErrors.contactName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="partner-phone">Contact Phone</Label>
                      <Input
                        id="partner-phone"
                        value={partnerForm.contactPhone}
                        onChange={(e) => {
                          setPartnerForm({
                            ...partnerForm,
                            contactPhone: e.target.value,
                          });
                          setPartnerFieldErrors({
                            ...partnerFieldErrors,
                            contactPhone: "",
                          });
                        }}
                        maxLength={MAX.contactPhone}
                        placeholder="+254712345678"
                      />
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Phone className="h-4 w-4 mr-2" />
                        <span>International format, e.g. +254712345678</span>
                      </div>
                      {partnerFieldErrors.contactPhone && (
                        <p className="text-sm text-destructive mt-1">
                          {partnerFieldErrors.contactPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="partner-email">Contact Email</Label>
                    <Input
                      id="partner-email"
                      value={partnerForm.contactEmail}
                      onChange={(e) => {
                        setPartnerForm({
                          ...partnerForm,
                          contactEmail: e.target.value,
                        });
                        setPartnerFieldErrors({
                          ...partnerFieldErrors,
                          contactEmail: "",
                        });
                      }}
                      maxLength={MAX.contactEmail}
                      placeholder="partner@domain.com"
                    />
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>Use an institutional email where possible.</span>
                    </div>
                    {partnerFieldErrors.contactEmail && (
                      <p className="text-sm text-destructive mt-1">
                        {partnerFieldErrors.contactEmail}
                      </p>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partner-start">Start Date</Label>
                      <Input
                        id="partner-start"
                        type="date"
                        value={partnerForm.startDate}
                        onChange={(e) =>
                          setPartnerForm({
                            ...partnerForm,
                            startDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPartnerAddOpen(false);
                          setPartnerFieldErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSavePartner}
                        disabled={!partnerFormValid}
                      >
                        {editingPartner ? "Update Partner" : "Save Partner"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "partner"
                ? `Remove partner ${deleteTarget.name} from the system?`
                : `Remove personnel ${deleteTarget?.name} from the system?`}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleDeleteConfirmed}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Partners"
          value={partners.length}
          subtitle={`${partners.filter((p) => p.status === "Active").length} Active`}
          icon={Building2}
          variant="primary"
        />
        <StatCard
          title="YBFs & Instructors"
          value={personnel.filter((p) => p.role !== "Enumerator").length}
          icon={UserCheck}
        />
        <StatCard
          title="Total Personnel"
          value={personnel.length}
          icon={Users}
          variant="success"
        />
      </div>

      {/* search removed as requested */}

      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners">
            Partners ({filteredPartners.length})
          </TabsTrigger>
          <TabsTrigger value="personnel">
            Personnel ({filteredPersonnel.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Cohorts</TableHead>
                    <TableHead>YBF</TableHead>
                    <TableHead>Status</TableHead>
                    {(canEditPartner || canDeletePartner) && (
                      <TableHead>Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={partnerColumnCount}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        Loading partners from backend...
                      </TableCell>
                    </TableRow>
                  ) : filteredPartners.length > 0 ? (
                    filteredPartners.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.type === "TVET" ? "default" : "secondary"
                            }
                          >
                            {p.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.location}</TableCell>
                        <TableCell>{p.district}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.contactName}
                          <br />
                          {p.contactPhone}
                          <br />
                          {p.contactEmail}
                        </TableCell>
                        <TableCell>
                          {p.startDate
                            ? new Date(p.startDate).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>{p.cohortsCount}</TableCell>
                        <TableCell>{p.assignedYBF}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "Active" ? "default" : "outline"
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        {(canEditPartner || canDeletePartner) && (
                          <TableCell className="flex gap-2">
                            {canEditPartner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditPartner(p)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeletePartner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  openDeleteTarget("partner", p.id, p.name)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={partnerColumnCount}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        No partner records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Personnel Records</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Youth Business Fellows, instructors and enumerators loaded
                  from the backend.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    {canManagePersonnel && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={personnelColumnCount}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        Loading personnel from backend...
                      </TableCell>
                    </TableRow>
                  ) : filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.contact}
                          <br />
                          {p.email}
                        </TableCell>
                        <TableCell>{p.assignedTo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.details}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "Active" ? "default" : "outline"
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        {canManagePersonnel && (
                          <TableCell className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditPersonnel(p)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openDeleteTarget("personnel", p.id, p.name)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={personnelColumnCount}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        No personnel records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
