import { useUser } from "@/hooks/use-user";
import AdminCases from "@/pages/admin/Cases";
import YBFCases from "@/pages/ybf/Cases";

const Cases = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access case management.</div>;
  }

  switch (user.role) {
    case 'admin':
    case 'program_manager':
    case 'program_leadership':
    case 'program_manager_out_of_school':
    case 'program_manager_in_school':
    case 'program_supervisor':
      return <AdminCases />;
    case 'ybf':
      return <YBFCases />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Cases;
