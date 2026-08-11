import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ReportDetails from './pages/ReportDetails';
import UploadReceipt from './pages/UploadReceipt';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report/:id" element={<ReportDetails />} />
          <Route path="/report/:id/upload" element={<UploadReceipt />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
