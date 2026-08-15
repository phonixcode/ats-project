import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import JobsPage from './pages/JobsPage';
import JobPostingPage from './pages/JobPostingPage';
import UploadPage from './pages/UploadPage';
import ReviewPage from './pages/ReviewPage';
import CandidateDetailPage from './pages/CandidateDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JobsPage />} />
        <Route path="/jobs/new" element={<JobPostingPage />} />
        <Route path="/jobs/:jobId/edit" element={<JobPostingPage />} />
        <Route path="/jobs/:jobId" element={<ReviewPage />} />
        <Route path="/jobs/:jobId/review" element={<ReviewPage />} />
        <Route path="/jobs/:jobId/upload" element={<UploadPage />} />
        <Route path="/applications/:applicationId" element={<CandidateDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
