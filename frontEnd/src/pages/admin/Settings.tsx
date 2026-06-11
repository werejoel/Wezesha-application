import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ORG_KEY = "wezesha_org_name";
const NOTIFY_KEY = "wezesha_email_notifications";
const COMPACT_KEY = "wezesha_compact_tables";

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

export default function AdminSettings() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("Wezesha Impact");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [compactTables, setCompactTables] = useState(false);

  useEffect(() => {
    setOrgName(localStorage.getItem(ORG_KEY) || "Wezesha Impact");
    setEmailNotifications(localStorage.getItem(NOTIFY_KEY) !== "false");
    setCompactTables(localStorage.getItem(COMPACT_KEY) === "true");
  }, []);

  const handleSave = () => {
    localStorage.setItem(ORG_KEY, orgName.trim() || "Wezesha Impact");
    localStorage.setItem(NOTIFY_KEY, String(emailNotifications));
    localStorage.setItem(COMPACT_KEY, String(compactTables));
    document.title = `${orgName.trim() || "Wezesha Impact"} — DMS`;
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">System Settings</h1>
            <p className="page-description">
              Configure appearance, organization details, and admin preferences.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <div
                    className={cn(
                      "h-14 rounded-lg border mb-3",
                      opt.preview,
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{opt.label}</span>
                    {selected && (
                      <Badge variant="default" className="ml-auto text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-secondary" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization display name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Wezesha Impact"
              className="mt-1.5 max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shown in the browser tab and header branding.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-info" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive alerts for at-risk youth and low attendance (UI preference).
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Compact data tables</p>
              <p className="text-xs text-muted-foreground">
                Use denser row spacing across list views.
              </p>
            </div>
            <Switch
              checked={compactTables}
              onCheckedChange={setCompactTables}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Administration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">Signed in as:</span>{" "}
              <strong>{user?.name}</strong> ({user?.email})
            </p>
            <p className="text-xs text-muted-foreground">
              Default accounts (created via <code className="text-xs">npm run seed</code>):
              <strong> admin@wezesha.org</strong> (Administrator) and{" "}
              <strong>manager@wezesha.org</strong> (Program Manager). Create YBF,
              instructors, and other staff from User Management.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/users">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
