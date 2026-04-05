import { useUser } from "@/hooks/use-user";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ProgramManagerDashboard from "@/pages/program-manager/ProgramManagerDashboard";
import YBFDashboard from "@/pages/ybf/YBFDashboard";
import InstructorDashboard from "@/pages/instructor/InstructorDashboard";
import EnumeratorDashboard from "@/pages/enumerator/EnumeratorDashboard";

// Main dashboard component that renders different views based on user role
const Dashboard = () => {
  const { user, loading } = useUser();

  if (loading) return <div>Loading...</div>;

  if (!user) return <div>Please log in to access the dashboard.</div>;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'program_manager':
      return <ProgramManagerDashboard />;
    case 'ybf':
      return <YBFDashboard />;
    case 'instructor':
      return <InstructorDashboard />;
    case 'enumerator':
      return <EnumeratorDashboard />;
    default:
      return <EnumeratorDashboard />; // Fallback to enumerator dashboard if role is unrecognized
  }
}
export default Dashboard;
