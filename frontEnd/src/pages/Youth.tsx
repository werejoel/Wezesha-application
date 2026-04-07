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
