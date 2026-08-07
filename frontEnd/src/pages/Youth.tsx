import { useUser } from "@/hooks/use-user";
import AdminYouth from "@/pages/admin/Youth";
import ProgramManagerYouth from "@/pages/program-manager/Youth";
import YBFYouth from "@/pages/ybf/Youth";
import InstructorYouth from "@/pages/instructor/Youth";

const Youth = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access youth data.</div>;
  }

  switch (user.role) {
    case 'admin':
      return <AdminYouth />;
    case 'program_manager':
    case 'program_leadership':
    case 'program_manager_out_of_school':
    case 'program_manager_in_school':
    case 'program_supervisor':
      return <ProgramManagerYouth />;
    case 'ybf':
      return <YBFYouth />;
    case 'instructor':
      return <InstructorYouth />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Youth;
