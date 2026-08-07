import { useUser } from "@/hooks/use-user";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ProgramManagerDashboard from "@/pages/program-manager/ProgramManagerDashboard";
import YBFDashboard from "@/pages/ybf/YBFDashboard";
import InstructorDashboard from "@/pages/instructor/InstructorDashboard";

// Main dashboard component that renders different views based on user role
const Dashboard = () => {
  const { user, loading } = useUser();

  if (loading) return <div>Loading...</div>;

  if (!user) return <div>Please log in to access the dashboard.</div>;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'program_manager':
    case 'program_leadership':
    case 'program_manager_out_of_school':
    case 'program_manager_in_school':
    case 'program_supervisor':
      return <ProgramManagerDashboard />;
    case 'ybf':
      return <YBFDashboard />;
    case 'instructor':
      return <InstructorDashboard />;
    default:
      return <ProgramManagerDashboard />;
  }
}
export default Dashboard;
