import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/UsersPage';
import ClassManager from './pages/ClassManager';
import ResourcesManager from './pages/ResourceManager';
import BooksManager from './pages/BooksManager';
import NoticesManager from './pages/NoticesManager';
import VideoPlaylistManager from './pages/VideoPlaylistManager';
import VideoManager from './pages/VideoManager';
import TestSeriesCollectionManager from './pages/TestSeriesCollectionManager';
import TestSeriesManager from './pages/TestSeriesManager';
import TestSeriesEditor from './pages/TestSeriesEditor';
import BulkTestSeriesCreator from './pages/BulkTestSeriesCreator';
import QuestionBankManager from './pages/QuestionBankManager';
import PaymentManager from './pages/PaymentManager';
import PromoCodeManager from './pages/PromoCodeManager';
import TicketManager from './pages/TicketManager';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

const protectedPage = (page: ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
          <Route path="/users" element={protectedPage(<UsersPage />)} />
          <Route path="/classmanager" element={protectedPage(<ClassManager />)} />
          <Route path="/resources" element={protectedPage(<ResourcesManager />)} />
          <Route path="/books" element={protectedPage(<BooksManager />)} />
          <Route path="/notices" element={protectedPage(<NoticesManager />)} />
          <Route path="/video-playlists" element={protectedPage(<VideoPlaylistManager />)} />
          <Route path="/videos" element={protectedPage(<VideoManager />)} />
          <Route path="/test-series/collections" element={protectedPage(<TestSeriesCollectionManager />)} />
          <Route path="/test-series" element={protectedPage(<TestSeriesManager />)} />
          <Route path="/test-series/new" element={protectedPage(<TestSeriesEditor />)} />
          <Route path="/test-series/:id/edit" element={protectedPage(<TestSeriesEditor />)} />
          <Route path="/test-series/bulk" element={protectedPage(<BulkTestSeriesCreator />)} />
          <Route path="/question-bank" element={protectedPage(<QuestionBankManager />)} />
          <Route path="/payments" element={protectedPage(<PaymentManager />)} />
          <Route path="/promo-codes" element={protectedPage(<PromoCodeManager />)} />
          <Route path="/tickets" element={protectedPage(<TicketManager />)} />
          <Route path="/settings" element={protectedPage(<AdminSettingsPage />)} />
          <Route path="/test-series/create" element={<Navigate to="/test-series/new" replace />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
