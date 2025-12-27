import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Booking from './pages/Booking';
import LiveQueue from './pages/LiveQueue';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';

const PrivateRoute = ({ children, doctorOnly = false }) => {
  const { currentUser, isDoctor } = useAuth();

  if (!currentUser) return <Navigate to="/login" />;
  if (doctorOnly && !isDoctor) return <Navigate to="/" />;

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/live-queue" element={<LiveQueue />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-use" element={<TermsOfUse />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute doctorOnly>
                  <Dashboard />
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
