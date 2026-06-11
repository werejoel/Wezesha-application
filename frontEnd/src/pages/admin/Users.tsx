import React, { useEffect, useState } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

export default function AdminUsers() {
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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const resp: any = await getUsers({ page, limit: pageSize, q: search });
        if (!mounted) return;
        // resp may be an array (old API) or object { rows, total }
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
    // validate
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
      // API returns user + token for register — normalize to created user
      const user = created.user || created;
      // if server-side paging is enabled, refresh current page
      if (page === 1) setUsers([user, ...users]);
      else setPage(1); // go to first page to show new user
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
    // open confirm dialog instead
    const target = users.find((u) => String(u.id) === String(id));
    setDeleteTarget(target || { id });
    setDeleteOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setDeleteOpen(false);
    const id = String(deleteTarget.id);
    const prev = users;
    // optimistic
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
    });
    setEditError(null);
    setEditFieldErrors({});
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditError(null);
    // field-level validation
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
      };
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
    <div className="space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-description">
            Create, view and manage application users
          </p>
        </div>
        <div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Create User</Button>
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
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
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
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                  >
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
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{deleteTarget?.email || deleteTarget?.id}</strong>?
                  This action cannot be undone.
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
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Total users
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {usersCount}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-700">
            Admins
          </p>
          <p className="mt-2 text-3xl font-semibold text-sky-900">
            {adminCount}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
            Program managers
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">
            {managerCount}
          </p>
        </div>
        <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-700">
            YBF
          </p>
          <p className="mt-2 text-3xl font-semibold text-fuchsia-900">
            {ybfCount}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <CardHeader className="bg-slate-50">
          <CardTitle>Role distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {roleDistribution.map((item) => {
            const percent = Math.round((item.count / distributionTotal) * 100);
            return (
              <div key={item.role} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span className="font-medium text-slate-900">
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {item.count} ({percent}%)
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-300`}
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
              <TableRow className="bg-slate-100/90">
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Name
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Email
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Role
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Created
                </TableHead>
                <TableHead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u, index) => (
                  <TableRow
                    key={u.id}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"} transition hover:bg-slate-100`}
                  >
                    <TableCell className="py-4 font-semibold text-slate-900">
                      {u.name || u.full_name || u.email}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-500">
                      {u.email}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-500">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="bg-sky-600 text-white hover:bg-sky-700"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          className={
                            u.role === "admin"
                              ? "bg-amber-500 text-slate-900 hover:bg-amber-600"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }
                          size="sm"
                          onClick={() => handleToggleRole(u)}
                        >
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </Button>
                        <Button
                          className="bg-rose-600 text-white hover:bg-rose-700"
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
    </div>
  );
}
