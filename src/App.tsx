import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import DashboardLayout from './components/DashboardLayout';
import DevToolsGuard from './components/DevToolsGuard';
import Dashboard from './pages/Dashboard';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyOTP from './pages/auth/VerifyOTP';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import SubjectResources from './pages/SubjectResources';
import SubjectDetails from './pages/SubjectDetails';
import CompetitiveSubjectPage from './pages/CompetitiveSubjectPage';
import NoticesPage from './pages/NoticesPage';
import NoticeDetailPage from './pages/NoticeDetailPage';
import ResourceView from './pages/ResourceView';
import ResourceEmbed from './pages/ResourceEmbed';
import PdfReader from './pages/PdfReader';
import TestSeriesPage from './pages/TestSeriesPage';
import CollectionContentPage from './pages/CollectionContentPage';
import QuizPlayerPage from './pages/QuizPlayerPage';
import QuizHistoryPage from './pages/QuizHistoryPage';
import QuizResultPage from './pages/QuizResultPage';
import ProfilePage from './pages/ProfilePage';
import HelpCenterPage from './pages/HelpCenterPage';
import SupportTicketDetailsPage from './pages/SupportTicketDetailsPage';
import NotFoundPage from './pages/NotFoundPage';
import CustomCursor from './components/CustomCursor';
import LegalPage from './pages/LegalPage';

function HomeRedirect() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CustomCursor />
          <Toaster position="top-center" reverseOrder={false} />
          <DevToolsGuard />
          <Routes>
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicRoute>
                  <VerifyOTP />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subjects"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SubjectResources />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subjects/:subjectName"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SubjectDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitive/:subjectName"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CompetitiveSubjectPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-series"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <TestSeriesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/books" element={<Navigate to="/subjects" replace />} />
            <Route
              path="/notices"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <NoticesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notices/:slug"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <NoticeDetailPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-series/:collectionId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CollectionContentPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-series/quiz/:quizId"
              element={
                <ProtectedRoute>
                  <QuizPlayerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-series/history/:quizId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <QuizHistoryPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-series/result/:attemptId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <QuizResultPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/subjects/:subjectName/:resourceType"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ResourceView />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/study/:resourceSlug"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ResourceEmbed />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/study/:resourceSlug/fullscreen"
              element={
                <ProtectedRoute>
                  <PdfReader />
                </ProtectedRoute>
              }
            />
            <Route path="/resource/embed" element={<Navigate to="/study/drawing-symbols" replace />} />
            <Route path="/resource/pdf" element={<Navigate to="/study/drawing-symbols/fullscreen" replace />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProfilePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Navigate to="/support" replace />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <HelpCenterPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/support-tickets" element={<Navigate to="/support" replace />} />
            <Route
              path="/support-tickets/:ticketId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupportTicketDetailsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Default redirect */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
