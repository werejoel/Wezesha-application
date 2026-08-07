import { useEffect, useState } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMe, logout } from "@/api";
import { useUser } from "@/hooks/use-user";
import { useNavigate } from "react-router-dom";

export function PendingValidationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, refreshUser } = useUser();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const pending =
    user &&
    (user.role === "ybf" || user.role === "instructor") &&
    (user.status === "pending" ||
      user.pendingApproval ||
      !user.assigned_to);

  useEffect(() => {
    if (!user || (user.role !== "ybf" && user.role !== "instructor")) return;
    let mounted = true;
    (async () => {
      try {
        setChecking(true);
        const fresh = await getMe();
        if (!mounted || !fresh) return;
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            ...fresh,
            role: fresh.role || user.role,
          }),
        );
        refreshUser();
      } catch {
        /* keep local user */
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (!pending) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="pointer-events-none opacity-30 blur-[1px] select-none">
        {children}
      </div>
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="h-7 w-7 text-amber-700" />
            </div>
            <DialogTitle className="text-center">
              Account validation in progress
            </DialogTitle>
            <DialogDescription className="text-center space-y-3 pt-2">
              <div>
                Your {user?.role === "ybf" ? "YBF" : "Instructor"} account is
                awaiting approval from a System Administrator or Program
                Manager.
              </div>
              <div className="flex items-center justify-center gap-2 text-amber-700 font-medium">
                <Clock className="h-4 w-4" />
                An institution must be assigned before you can access the
                dashboard.
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  const fresh = await getMe();
                  localStorage.setItem(
                    "user",
                    JSON.stringify({ ...user, ...fresh }),
                  );
                  refreshUser();
                } catch {
                  /* ignore */
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? "Checking status…" : "Refresh status"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                refreshUser();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
