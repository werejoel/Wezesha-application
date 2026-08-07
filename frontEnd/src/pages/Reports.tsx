import { useUser } from "@/hooks/use-user";
import AdminReports from "@/pages/admin/Reports";
import ProgramManagerReports from "@/pages/program-manager/Reports";

const Reports = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access reports.</div>;
  }

  switch (user.role) {
    case 'admin':
      return <AdminReports />;
    case 'program_manager':
    case 'program_leadership':
    case 'program_manager_out_of_school':
    case 'program_manager_in_school':
    case 'program_supervisor':
      return <ProgramManagerReports />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Reports;
