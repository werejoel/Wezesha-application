import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Users,
  Building2,
  Bell,
  Shield,
  Save,
  UserCheck,
  UserX,
  Ban,
  Search,
  RefreshCw,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getUsers, updateUserStatus } from "@/api";

const ORG_KEY = "wezesha_org_name";
const NOTIFY_KEY = "wezesha_email_notifications";
const COMPACT_KEY = "wezesha_compact_tables";
const MAINTENANCE_KEY = "wezesha_maintenance_mode";

type UserStatus = "active" | "inactive" | "blocked";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  created_at?: string;
};

const themeOptions: {
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
  preview: string;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright workspace for daytime use",
    icon: Sun,
    preview: "bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Reduced glare for low-light environments",
    icon: Moon,
    preview: "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-600",
  },
  {
    value: "system",
    label: "System",
    description: "Match your device appearance",
    icon: Monitor,
    preview: "bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300",
  },
];

const statusBadge = (status: UserStatus) => {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Active
      </Badge>
    );
  }
  if (status === "inactive") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900">
        Inactive
      </Badge>
    );
  }
  return <Badge variant="destructive">Blocked</Badge>;
};

export default function AdminSettings() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("Wezesha Impact");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [compactTables, setCompactTables] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const resp: any = await getUsers({ page: 1, limit: 100, q: userSearch });
      const rows = Array.isArray(resp) ? resp : resp.rows || [];
      setUsers(
        rows.map((u: any) => ({
          id: String(u.id),
          name: u.name || u.email,
          email: u.email,
          role: u.role,
          status: (u.status || "active") as UserStatus,
          created_at: u.created_at,
        })),
      );
    } catch (err: any) {
      toast({
        title: "Could not load users",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, toast]);

  useEffect(() => {
    setOrgName(localStorage.getItem(ORG_KEY) || "Wezesha Impact");
    setEmailNotifications(localStorage.getItem(NOTIFY_KEY) !== "false");
    setCompactTables(localStorage.getItem(COMPACT_KEY) === "true");
    setMaintenanceMode(localStorage.getItem(MAINTENANCE_KEY) === "true");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      statusFilter === "all" ? true : u.status === statusFilter,
    );
  }, [users, statusFilter]);

  const statusCounts = useMemo(() => {
    return users.reduce(
      (acc, u) => {
        acc[u.status] = (acc[u.status] || 0) + 1;
        return acc;
      },
      { active: 0, inactive: 0, blocked: 0 } as Record<UserStatus, number>,
    );
  }, [users]);

  const handleSave = () => {
    localStorage.setItem(ORG_KEY, orgName.trim() || "Wezesha Impact");
    localStorage.setItem(NOTIFY_KEY, String(emailNotifications));
    localStorage.setItem(COMPACT_KEY, String(compactTables));
    localStorage.setItem(MAINTENANCE_KEY, String(maintenanceMode));
    document.title = `${orgName.trim() || "Wezesha Impact"} — DMS`;
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
  };

  const handleStatusChange = async (target: ManagedUser, status: UserStatus) => {
    if (String(target.id) === String(user?.id) && status !== "active") {
      toast({
        title: "Action not allowed",
        description: "You cannot deactivate or block your own account.",
        variant: "destructive",
      });
      return;
    }
    setStatusUpdating(target.id);
    try {
      const updated = await updateUserStatus(target.id, status);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id
            ? { ...u, status: (updated.status || status) as UserStatus }
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">System Settings</h1>
            <p className="page-description">
              Appearance, organization preferences, and user access control.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-emerald-900">{statusCounts.active}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-bold text-amber-900">{statusCounts.inactive}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 uppercase tracking-wide">Blocked</p>
            <p className="text-2xl font-bold text-red-900">{statusCounts.blocked}</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-sky-700 uppercase tracking-wide">Total users</p>
            <p className="text-2xl font-bold text-sky-900">{users.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            User access control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "active", "inactive", "blocked"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? "default" : "outline"}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={loadUsers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Loading users…
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No users match your filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            disabled={statusUpdating === u.id || u.status === "active"}
                            onClick={() => handleStatusChange(u, "active")}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Activate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                            disabled={statusUpdating === u.id || u.status === "inactive"}
                            onClick={() => handleStatusChange(u, "inactive")}
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            Deactivate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-200 hover:bg-red-50"
                            disabled={statusUpdating === u.id || u.status === "blocked"}
                            onClick={() => handleStatusChange(u, "blocked")}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            Block
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/users">
                <Users className="h-4 w-4 mr-2" />
                Full user management
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const selected = theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all hover:shadow-md",
                    selected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className={cn("h-14 rounded-lg border mb-3", opt.preview)} />
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{opt.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-secondary" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="org-name">Display name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1.5"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-info" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Email notifications</Label>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Compact tables</Label>
              <Switch checked={compactTables} onCheckedChange={setCompactTables} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">UI banner for planned downtime</p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Signed in as <strong>{user?.name}</strong> ({user?.email}). Default accounts:
          admin@wezesha.org and manager@wezesha.org (via seed).
        </CardContent>
      </Card>
    </div>
  );
}
