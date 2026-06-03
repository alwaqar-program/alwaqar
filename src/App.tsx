import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Applicants from './pages/Applicants';
import ApplicantDetail from './pages/ApplicantDetail';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applicants" element={<Applicants />} />
          <Route path="/applicants/:id" element={<ApplicantDetail />} />
          <Route path="/students" element={<Placeholder title="الطالبات" />} />
          <Route path="/settings" element={<Placeholder title="الإعدادات" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
