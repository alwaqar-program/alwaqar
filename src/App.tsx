import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BranchesPage from "./pages/BranchesPage";
import CirclesPage from "./pages/CirclesPage";
import TeachersPage from "./pages/TeachersPage";
import StudentsPage from "./pages/StudentsPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import CompanionsPage from "./pages/CompanionsPage";
import MubtadiatPage from "./pages/MubtadiatPage";
import StaffPage from "./pages/StaffPage";
import RoomsPage from "./pages/RoomsPage";
import RecitationPage from "./pages/RecitationPage";
import AttendancePage from "./pages/AttendancePage";
import ExamsPage from "./pages/ExamsPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import PledgesPage from "./pages/PledgesPage";
import ViolationsPage from "./pages/ViolationsPage";
import LeaveRequestsPage from "./pages/LeaveRequestsPage";
import ApplicantsPage from "./pages/ApplicantsPage";
import ApplicantProfilePage from "./pages/ApplicantProfilePage";
import PledgePage from "./pages/PledgePage";
import RegNumberPage from "./pages/RegNumberPage";
import RoommatesPage from "./pages/RoommatesPage";
import SupervisorRegistrationPage from "./pages/SupervisorRegistrationPage";
import PaymentPage from "./pages/PaymentPage";
import InterviewPage from "./pages/InterviewPage";
import TeacherRecitationPage from "./pages/teacher/TeacherRecitationPage";
import TeacherAttendancePage from "./pages/teacher/TeacherAttendancePage";
import TeacherExamPage from "./pages/teacher/TeacherExamPage";
import PublicRecitationPage from "./pages/PublicRecitationPage";
import PublicAttendancePage from "./pages/PublicAttendancePage";
import InterviewCommitteePage from "./pages/InterviewCommitteePage";
import CommitteeMemberProfilePage from "./pages/CommitteeMemberProfilePage";
import InterviewsListPage from "./pages/InterviewsListPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AppLayout from "./components/layout/AppLayout";
import NotFound from "./pages/NotFound";
import logoImg from "@/assets/logo.png";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="شعار تمام" className="w-16 h-16 object-contain mx-auto" />
          <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/pledge" element={<PledgePage />} />
            <Route path="/reg-number" element={<RegNumberPage />} />
            <Route path="/roommates" element={<RoommatesPage />} />
            <Route path="/supervisor-registration" element={<SupervisorRegistrationPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/teacher/recitation" element={<TeacherRecitationPage />} />
            <Route path="/teacher/attendance" element={<TeacherAttendancePage />} />
            <Route path="/teacher/exam" element={<TeacherExamPage />} />
            <Route path="/recite" element={<PublicRecitationPage />} />
            <Route path="/attend" element={<PublicAttendancePage />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute><BranchesPage /></ProtectedRoute>} />
            <Route path="/circles" element={<ProtectedRoute><CirclesPage /></ProtectedRoute>} />
            <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute><StudentProfilePage /></ProtectedRoute>} />
            <Route path="/companions" element={<ProtectedRoute><CompanionsPage /></ProtectedRoute>} />
            <Route path="/mubtadiat" element={<ProtectedRoute><MubtadiatPage /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
            <Route path="/rooms" element={<ProtectedRoute><RoomsPage /></ProtectedRoute>} />
            <Route path="/recitation" element={<ProtectedRoute><RecitationPage /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
            <Route path="/exams" element={<ProtectedRoute><ExamsPage /></ProtectedRoute>} />
            <Route path="/pledges" element={<ProtectedRoute><PledgesPage /></ProtectedRoute>} />
            <Route path="/violations" element={<ProtectedRoute><ViolationsPage /></ProtectedRoute>} />
            <Route path="/leave-requests" element={<ProtectedRoute><LeaveRequestsPage /></ProtectedRoute>} />
            <Route path="/applicants" element={<ProtectedRoute><ApplicantsPage /></ProtectedRoute>} />
            <Route path="/applicants/:id" element={<ProtectedRoute><ApplicantProfilePage /></ProtectedRoute>} />
            <Route path="/interview-committee" element={<ProtectedRoute><InterviewCommitteePage /></ProtectedRoute>} />
            <Route path="/interview-committee/:id" element={<ProtectedRoute><CommitteeMemberProfilePage /></ProtectedRoute>} />
            <Route path="/interviews" element={<ProtectedRoute><InterviewsListPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
