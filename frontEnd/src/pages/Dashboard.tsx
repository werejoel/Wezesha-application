import { useUser } from "@/hooks/use-user";
import AdminDashboard from "./AdminDashboard";
import YBFDashboard from "./YBFDashboard";
import InstructorDashboard from "./InstructorDashboard";
import EnumeratorDashboard from "./EnumeratorDashboard";

export default function Dashboard() {
  const { user, loading } = useUser();

  if (loading) return <div>Loading...</div>;

  if (!user) return <div>Please log in to access the dashboard.</div>;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'ybf':
      return <YBFDashboard />;
    case 'instructor':
      return <InstructorDashboard />;
    case 'enumerator':
      return <EnumeratorDashboard />;
    default:
      return <AdminDashboard />; // fallback to admin dashboard
  }
}
