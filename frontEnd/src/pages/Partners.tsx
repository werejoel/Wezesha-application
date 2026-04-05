import { useUser } from "@/hooks/use-user";
import AdminPartners from "@/pages/admin/Partners";
import ProgramManagerPartners from "@/pages/program-manager/Partners";

const Partners = () => {
  const { user } = useUser();

  if (!user) {
    return <div>Please log in to access partners.</div>;
  }

  switch (user.role) {
    case 'admin':
      return <AdminPartners />;
    case 'program_manager':
      return <ProgramManagerPartners />;
    default:
      return <div className="text-sm text-muted-foreground">You are not authorized to view this page.</div>;
  }
};

export default Partners;
