import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout   from './components/layout/AppLayout';
import Calculator  from './components/Calculator';
import ChatBot     from './components/ChatBot';
import Login       from './pages/auth/Login';
import Dashboard   from './pages/Dashboard';
import Parties     from './pages/parties/Parties';
import AddParty    from './pages/parties/AddParty';
import PartyDetail from './pages/parties/PartyDetail';
import Reports     from './pages/Reports';
import More        from './pages/More';
import Billing     from './pages/billing/Billing';
import Profile     from './pages/Profile';

function Private({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
function Public({ children }) {
  const { token } = useAuth();
  return !token ? children : <Navigate to="/" replace />;
}
function FloatingUI() {
  const { token } = useAuth();
  if (!token) return null;
  return <><Calculator /><ChatBot /></>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{
          duration: 2800,
          style: { borderRadius:'12px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:'14px', fontWeight:'600', maxWidth:'340px' },
          success: { iconTheme: { primary:'#1a9e5c', secondary:'#fff' } },
          error:   { iconTheme: { primary:'#e53935', secondary:'#fff' } },
        }} />
        <Routes>
          <Route path="/login" element={<Public><Login /></Public>} />
          <Route path="/" element={<Private><AppLayout /></Private>}>
            <Route index                element={<Dashboard />} />
            <Route path="parties"       element={<Parties />} />
            <Route path="parties/add"   element={<AddParty />} />
            <Route path="parties/:id"   element={<PartyDetail />} />
            <Route path="reports"       element={<Reports />} />
            <Route path="more"          element={<More />} />
            <Route path="more/billing"  element={<Billing />} />
            <Route path="more/profile"  element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <FloatingUI />
      </BrowserRouter>
    </AuthProvider>
  );
}
