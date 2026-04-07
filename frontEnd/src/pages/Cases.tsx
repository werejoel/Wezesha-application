import { useUser } from "@/hooks/use-user";
import AdminCases from "@/pages/admin/Cases";
import EnumeratorCases from "@/pages/enumerator/Cases";

const Cases = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access case management.</div>;
  }

  switch (user.role) {
    case 'admin':
    case 'program_manager':
      return <AdminCases />;
    case 'enumerator':
      return <EnumeratorCases />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Cases;
