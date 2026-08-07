import { useUser } from "@/hooks/use-user";
import AdminSessions from "@/pages/admin/Sessions";
import ProgramManagerSessions from "@/pages/program-manager/Sessions";
import YBFSessions from "@/pages/ybf/Sessions";
import InstructorSessions from "@/pages/instructor/Sessions";

const Sessions = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access sessions.</div>;
  }

  switch (user.role) {
    case 'admin':
      return <AdminSessions />;
    case 'program_manager':
    case 'program_leadership':
    case 'program_manager_out_of_school':
    case 'program_manager_in_school':
    case 'program_supervisor':
      return <ProgramManagerSessions />;
    case 'ybf':
      return <YBFSessions />;
    case 'instructor':
      return <InstructorSessions />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Sessions;
