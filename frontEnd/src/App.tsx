import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/hooks/use-user";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Partners from "./pages/Partners";
import Youth from "./pages/Youth";
import Sessions from "./pages/Sessions";
import Cases from "./pages/Cases";
import Outcomes from "./pages/Outcomes";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

const queryClient = new QueryClient();

const RoleProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const { user, loading } = useUser();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'ybf', 'instructor', 'enumerator']}>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route
                        path="/partners"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'ybf']}>
                            <Partners />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route
                        path="/youth"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'ybf', 'instructor']}>
                            <Youth />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route
                        path="/sessions"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'ybf', 'instructor', 'enumerator']}>
                            <Sessions />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route
                        path="/cases"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'enumerator']}>
                            <Cases />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route
                        path="/outcomes"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager', 'ybf']}>
                            <Outcomes />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <RoleProtectedRoute allowedRoles={['admin', 'program_manager']}>
                            <Reports />
                          </RoleProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </RoleProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);
export default App;
