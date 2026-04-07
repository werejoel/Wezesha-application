import { useUser } from "@/hooks/use-user";
import AdminOutcomes from "@/pages/admin/Outcomes";
import YBFOutcomes from "@/pages/ybf/Outcomes";
import InstructorOutcomes from "@/pages/instructor/Outcomes";

const Outcomes = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access outcomes.</div>;
  }

  switch (user.role) {
    case 'admin':
    case 'program_manager':
      return <AdminOutcomes />;
    case 'ybf':
      return <YBFOutcomes />;
    case 'instructor':
      return <InstructorOutcomes />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Outcomes;
