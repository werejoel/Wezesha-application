import { ReactNode } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type FormTheme = "youth" | "partner" | "personnel";

const themes: Record<
  FormTheme,
  {
    header: string;
    border: string;
    title: string;
    section: string;
    submit: string;
    iconWrap: string;
  }
> = {
  youth: {
    header: "bg-gradient-to-br from-primary/20 via-primary/10 to-accent/30",
    border: "border-primary/25",
    title: "text-primary",
    section: "border-l-4 border-primary bg-primary/[0.06] rounded-r-lg",
    submit: "bg-primary hover:bg-primary/90 text-primary-foreground",
    iconWrap: "bg-primary/15 text-primary",
  },
  partner: {
    header: "bg-gradient-to-br from-secondary/30 via-amber-50 to-orange-50",
    border: "border-secondary/40",
    title: "text-secondary-foreground",
    section: "border-l-4 border-secondary bg-secondary/10 rounded-r-lg",
    submit: "bg-secondary hover:bg-secondary/90 text-secondary-foreground",
    iconWrap: "bg-secondary/20 text-secondary-foreground",
  },
  personnel: {
    header: "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-50",
    border: "border-sky-200",
    title: "text-sky-900",
    section: "border-l-4 border-sky-500 bg-sky-50/80 rounded-r-lg",
    submit: "bg-sky-600 hover:bg-sky-700 text-white",
    iconWrap: "bg-sky-100 text-sky-700",
  },
};

type FormDialogShellProps = {
  theme: FormTheme;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function FormDialogShell({
  theme,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: FormDialogShellProps) {
  const t = themes[theme];

  return (
    <DialogContent
      className={cn("sm:max-w-xl p-0 gap-0 overflow-hidden", t.border, className)}
    >
      <div className={cn("px-6 py-5 border-b", t.header)}>
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  t.iconWrap,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div>
              <DialogTitle className={cn("font-heading text-lg", t.title)}>
                {title}
              </DialogTitle>
              {subtitle ? (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </DialogHeader>
      </div>
      <div className="px-6 py-5 max-h-[72vh] overflow-y-auto">{children}</div>
    </DialogContent>
  );
}

export function FormSection({
  theme,
  title,
  children,
}: {
  theme: FormTheme;
  title: string;
  children: ReactNode;
}) {
  const t = themes[theme];
  return (
    <div className={cn("p-4 space-y-3", t.section)}>
      <h4 className="text-sm font-semibold font-heading tracking-wide uppercase opacity-80">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function FormActions({
  theme,
  onCancel,
  onSubmit,
  submitLabel,
  cancelLabel = "Cancel",
  disabled,
  destructive,
}: {
  theme: FormTheme;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  cancelLabel?: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const t = themes[theme];
  return (
    <div className="flex justify-end gap-2 pt-2 border-t mt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="button"
        className={destructive ? undefined : t.submit}
        variant={destructive ? "destructive" : "default"}
        onClick={onSubmit}
        disabled={disabled}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

export function FormFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

export const formSelectClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
