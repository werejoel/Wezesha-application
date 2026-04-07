import { useUser } from "@/hooks/use-user";
import AdminSessions from "@/pages/admin/Sessions";
import ProgramManagerSessions from "@/pages/program-manager/Sessions";
import YBFSessions from "@/pages/ybf/Sessions";
import InstructorSessions from "@/pages/instructor/Sessions";
import EnumeratorSessions from "@/pages/enumerator/Sessions";

const Sessions = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access sessions.</div>;
  }

  switch (user.role) {
    case 'admin':
      return <AdminSessions />;
    case 'program_manager':
      return <ProgramManagerSessions />;
    case 'ybf':
      return <YBFSessions />;
    case 'instructor':
      return <InstructorSessions />;
    case 'enumerator':
      return <EnumeratorSessions />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Sessions;
