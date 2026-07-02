import React, { useEffect, useState } from "react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  getPartners,
} from "@/api";
import { useUser } from "@/hooks/use-user";
import { Badge } from "@/components/ui/badge";
import { Ban, UserCheck, UserX, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type UserStatus = "active" | "inactive" | "blocked" | "pending";

const statusBadge = (status: UserStatus) => {
  if (status === "pending") {
    return (
      <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-200 px-3 py-1 text-xs font-medium transition-all duration-300">
        Pending Approval
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1 text-xs font-medium transition-all duration-300">
        Active
      </Badge>
    );
  }
  if (status === "inactive") {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1 text-xs font-medium transition-all duration-300">
        Inactive
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 text-xs font-medium transition-all duration-300">
      Blocked
    </Badge>
  );
};

export default function AdminUsers() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "enumerator",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "enumerator",
    assignedTo: "",
    status: "active" as UserStatus,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<
    Record<string, string>
  >({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<
    Record<string, string>
  >({});
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [approvePartner, setApprovePartner] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    getPartners()
      .then((rows) => setPartners(Array.isArray(rows) ? rows : []))
      .catch(() => setPartners([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const resp: any = await getUsers({ page, limit: pageSize, q: search });
        if (!mounted) return;
        if (Array.isArray(resp)) {
          setUsers(resp || []);
          setTotalCount(resp.length);
        } else {
          setUsers(resp.rows || []);
          setTotalCount(resp.total || 0);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [page, pageSize, search]);

  // live-validate create form
  useEffect(() => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "Invalid email format";
    if (form.name.length > 100) errs.name = "Name is too long (max 100)";
    if (form.email.length > 255) errs.email = "Email is too long (max 255)";
    if (
      !form.password ||
      form.password.length < 8 ||
      form.password.length > 128
    )
      errs.password = "Password must be 8-128 characters";
    setCreateFieldErrors(errs);
  }, [form]);

  const handleCreate = async () => {
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "Invalid email format";
    if (form.name.length > 100) errs.name = "Name is too long (max 100)";
    if (form.email.length > 255) errs.email = "Email is too long (max 255)";
    if (
      !form.password ||
      form.password.length < 8 ||
      form.password.length > 128
    )
      errs.password = "Password must be 8-128 characters";
    setCreateFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const created = await createUser(
        form.name,
        form.email,
        form.password,
        form.role,
      );
      const user = created.user || created;
      if (page === 1) setUsers([user, ...users]);
      else setPage(1);
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", role: "enumerator" });
      toast({ title: "User created", description: `${user.email} created` });
    } catch (err: any) {
      setFormError(err?.message || "Failed to create user");
      toast({
        title: "Create failed",
        description: String(err?.message || "Failed to create user"),
      });
    }
  };

  const handleDelete = async (id: string) => {
    const target = users.find((u) => String(u.id) === String(id));
    setDeleteTarget(target || { id });
    setDeleteOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleteOpen(false);
    const id = String(deleteTarget.id);
    const prev = users;
    setUsers(users.filter((u) => String(u.id) !== id));
    try {
      await deleteUser(id);
      toast({ title: "User deleted", variant: "destructive" });
    } catch (err: any) {
      setUsers(prev);
      const msg = err?.message || "Failed to delete user";
      setError(msg);
      toast({
        title: "Delete failed",
        description: String(msg),
        variant: "destructive",
      });
    }
    setDeleteTarget(null);
  };

  const handleToggleRole = async (u: any) => {
    const newRole = u.role === "admin" ? "enumerator" : "admin";
    try {
      const updated = await updateUser(String(u.id), {
        name: u.name,
        email: u.email,
        role: newRole,
      });
      setUsers(users.map((x) => (String(x.id) === String(u.id) ? updated : x)));
      toast({
        title: "User updated",
        description: `${updated.email} role set to ${updated.role}`,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to update user");
      toast({
        title: "Update failed",
        description: String(err?.message || "Failed to update user"),
      });
    }
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || u.full_name || "",
      email: u.email || "",
      password: "",
      role: u.role || "enumerator",
      assignedTo: u.assigned_to ? String(u.assigned_to) : "",
      status: (u.status || "active") as UserStatus,
    });
    setEditError(null);
    setEditFieldErrors({});
    setEditOpen(true);
  };

  const handleApproveUser = async (u: any, partnerId: string) => {
    if (!partnerId) {
      toast({
        title: "Institution required",
        description: "Assign a school/institution before approving.",
        variant: "destructive",
      });
      return;
    }
    try {
      const updated = await updateUser(String(u.id), {
        assigned_to: partnerId,
        status: "active",
      });
      setUsers(
        users.map((x) =>
          String(x.id) === String(u.id) ? { ...x, ...updated } : x,
        ),
      );
      toast({
        title: "User approved",
        description: `${u.email} can now access the dashboard.`,
      });
    } catch (err: any) {
      toast({
        title: "Approval failed",
        description: err?.message || "Could not approve user",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (target: any, status: UserStatus) => {
    if (String(target.id) === String(currentUser?.id) && status !== "active") {
      toast({
        title: "Action not allowed",
        description: "You cannot deactivate or block your own account.",
        variant: "destructive",
      });
      return;
    }
    setStatusUpdating(String(target.id));
    try {
      const updated = await updateUserStatus(String(target.id), status);
      setUsers(
        users.map((u) =>
          String(u.id) === String(target.id)
            ? { ...u, status: updated.status || status }
            : u,
        ),
      );
      toast({
        title: "Account updated",
        description: `${target.email} is now ${status}.`,
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update account status.",
        variant: "destructive",
      });
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditError(null);
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = "Name is required";
    if (!editForm.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(editForm.email))
      errs.email = "Invalid email format";
    if (editForm.name.length > 100) errs.name = "Name is too long (max 100)";
    if (editForm.email.length > 255) errs.email = "Email is too long (max 255)";
    if (
      editForm.password &&
      (editForm.password.length < 8 || editForm.password.length > 128)
    )
      errs.password = "Password must be 8-128 characters";
    setEditFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const payload: any = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.assignedTo) payload.assigned_to = editForm.assignedTo;
      if (editForm.password) payload.password = editForm.password;
      const updated = await updateUser(String(editingUser.id), payload);
      setUsers(
        users.map((u) =>
          String(u.id) === String(editingUser.id) ? updated : u,
        ),
      );
      setEditOpen(false);
      setEditingUser(null);
      toast({ title: "User updated", description: `${updated.email} saved` });
    } catch (err: any) {
      setEditError(err?.message || "Failed to update user");
      toast({
        title: "Update failed",
        description: String(err?.message || "Failed to update user"),
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const usersCount = totalCount || users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "program_manager").length;
  const ybfCount = users.filter((u) => u.role === "ybf").length;
  const instructorCount = users.filter((u) => u.role === "instructor").length;
  const enumeratorCount = users.filter((u) => u.role === "enumerator").length;
  const activeCount = users.filter(
    (u) => (u.status || "active") === "active",
  ).length;
  const inactiveCount = users.filter((u) => u.status === "inactive").length;
  const blockedCount = users.filter((u) => u.status === "blocked").length;
  const distributionTotal = Math.max(usersCount, 1);
  const roleDistribution = [
    { role: "admin", label: "Admins", count: adminCount, color: "bg-sky-500" },
    {
      role: "program_manager",
      label: "Program Managers",
      count: managerCount,
      color: "bg-emerald-500",
    },
    { role: "ybf", label: "YBF", count: ybfCount, color: "bg-fuchsia-500" },
    {
      role: "instructor",
      label: "Instructors",
      count: instructorCount,
      color: "bg-violet-500",
    },
    {
      role: "enumerator",
      label: "Enumerators",
      count: enumeratorCount,
      color: "bg-slate-500",
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1
            style={{
              color: "var(--slate-900)",
              fontFamily: "var(--font-sans)",
            }}
            className="text-4xl font-semibold tracking-tight text-slate-900"
          >
            User Management
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Create, view and manage application users
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button 
            style={{backgroundColor:"hsl(152, 55%, 33%)"}}
            className="hover:from-violet-700 hover:to-indigo-700 shadow-lg  text-white px-6 py-2.5 text-base font-medium transition-all hover:scale-105 active:scale-95">
              + Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              {formError && (
                <div className="text-sm text-destructive">{formError}</div>
              )}
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {createFieldErrors.name && (
                  <p className="text-xs text-destructive mt-1">
                    {createFieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                />
                {createFieldErrors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {createFieldErrors.email}
                  </p>
                )}
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  type="password"
                />
                {createFieldErrors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {createFieldErrors.password}
                  </p>
                )}
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="admin">admin</option>
                  <option value="program_manager">program_manager</option>
                  <option value="ybf">ybf</option>
                  <option value="instructor">instructor</option>
                  <option value="enumerator">enumerator</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={Object.keys(createFieldErrors).length > 0}
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300 dark:border-slate-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Total users
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {usersCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300 dark:border-slate-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-700 dark:text-sky-300">
              Admins
            </p>
            <p className="mt-2 text-2xl font-semibold text-sky-900 dark:text-sky-100">
              {adminCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300 dark:border-slate-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
              Program managers
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
              {managerCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300 dark:border-slate-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fuchsia-700 dark:text-fuchsia-300">
              YBF
            </p>
            <p className="mt-2 text-2xl font-semibold text-fuchsia-900 dark:text-fuchsia-100">
              {ybfCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border border-emerald-200 bg-white hover:shadow-lg transition-all duration-300 dark:border-emerald-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
              Active accounts
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
              {activeCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-amber-200 bg-white hover:shadow-lg transition-all duration-300 dark:border-amber-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">
              Inactive
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-900 dark:text-amber-100">
              {inactiveCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-red-200 bg-white hover:shadow-lg transition-all duration-300 dark:border-red-700/40 dark:bg-slate-950">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-700 dark:text-red-300">
              Blocked
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-900 dark:text-red-100">
              {blockedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <CardHeader className="bg-slate-50 dark:bg-slate-900">
          <CardTitle className="text-slate-900 dark:text-slate-100">
            Role distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {roleDistribution.map((item) => {
            const percent = Math.round((item.count / distributionTotal) * 100);
            return (
              <div key={item.role} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {item.count} ({percent}%)
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 justify-start">
          <Input
            placeholder="Search users by name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Per page</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border bg-card px-2 py-1 text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Prev
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-slate-100/90 dark:bg-slate-900/95">
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Name
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Email
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Role
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Status
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Created
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-80">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative flex h-20 w-20 items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
                        <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-violet-200/40" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-200 font-medium">
                        Loading users...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u, index) => (
                  <TableRow
                    key={u.id}
                    className={`${index % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/60 dark:bg-slate-900/60"} group hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200`}
                  >
                    <TableCell className="py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {u.name || u.full_name || u.email}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-500 dark:text-slate-400">
                      {u.email}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {statusBadge((u.status || "active") as UserStatus)}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-500 dark:text-slate-400">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        {(u.status === "pending" ||
                          ((u.role === "ybf" || u.role === "instructor") &&
                            !u.assigned_to)) &&
                          (u.role === "ybf" || u.role === "instructor") && (
                            <>
                              <select
                                className="rounded border px-2 py-1 text-xs focus:ring-2 focus:ring-violet-500"
                                value={approvePartner[String(u.id)] || ""}
                                onChange={(e) =>
                                  setApprovePartner({
                                    ...approvePartner,
                                    [String(u.id)]: e.target.value,
                                  })
                                }
                              >
                                <option value="">Assign institution</option>
                                {partners.map((p) => (
                                  <option key={p.id} value={String(p.id)}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                                onClick={() =>
                                  handleApproveUser(
                                    u,
                                    approvePartner[String(u.id)] || "",
                                  )
                                }
                              >
                                Approve
                              </Button>
                            </>
                          )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 transition-all active:scale-95"
                          disabled={
                            statusUpdating === String(u.id) ||
                            (u.status || "active") === "active"
                          }
                          onClick={() => handleStatusChange(u, "active")}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Activate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-200 hover:bg-amber-50 transition-all active:scale-95"
                          disabled={
                            statusUpdating === String(u.id) ||
                            u.status === "inactive"
                          }
                          onClick={() => handleStatusChange(u, "inactive")}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          Deactivate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-700 border-red-200 hover:bg-red-50 transition-all active:scale-95"
                          disabled={
                            statusUpdating === String(u.id) ||
                            u.status === "blocked"
                          }
                          onClick={() => handleStatusChange(u, "blocked")}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Block
                        </Button>
                        <Button
                          className="bg-sky-600 text-white hover:bg-sky-700 transition-all active:scale-95"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          className={
                            u.role === "admin"
                              ? "bg-amber-500 text-slate-900 hover:bg-amber-600 transition-all active:scale-95"
                              : "bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95"
                          }
                          size="sm"
                          onClick={() => handleToggleRole(u)}
                        >
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </Button>
                        <Button
                          className="bg-rose-600 text-white hover:bg-rose-700 transition-all active:scale-95"
                          size="sm"
                          onClick={() => handleDelete(String(u.id))}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.email || deleteTarget?.id}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirmed}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {editError && (
              <div className="text-sm text-destructive">{editError}</div>
            )}
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
              {editFieldErrors.name && (
                <p className="text-xs text-destructive mt-1">
                  {editFieldErrors.name}
                </p>
              )}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                type="email"
              />
              {editFieldErrors.email && (
                <p className="text-xs text-destructive mt-1">
                  {editFieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <Label>Password (leave blank to keep)</Label>
              <Input
                value={editForm.password}
                onChange={(e) =>
                  setEditForm({ ...editForm, password: e.target.value })
                }
                type="password"
              />
              {editFieldErrors.password && (
                <p className="text-xs text-destructive mt-1">
                  {editFieldErrors.password}
                </p>
              )}
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value })
                }
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="admin">admin</option>
                <option value="program_manager">program_manager</option>
                <option value="ybf">ybf</option>
                <option value="instructor">instructor</option>
                <option value="enumerator">enumerator</option>
              </select>
            </div>
            {(editForm.role === "ybf" || editForm.role === "instructor") && (
              <div>
                <Label>Assigned Institution</Label>
                <select
                  value={editForm.assignedTo}
                  onChange={(e) =>
                    setEditForm({ ...editForm, assignedTo: e.target.value })
                  }
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select institution</option>
                  {partners.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label>Status</Label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    status: e.target.value as UserStatus,
                  })
                }
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
