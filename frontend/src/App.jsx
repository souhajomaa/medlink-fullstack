import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './shared/context/AuthContext';
import Layout from './shared/components/Layout';

// Pages publiques
import Landing from './shared/pages/Landing';
import Login from './modules/auth/pages/Login';
import Signup from './modules/auth/pages/Signup';
import SignupPractitioner from './modules/auth/pages/SignupPractitioner';

// Pages de l'application
import Dashboard from './shared/pages/Dashboard';
import Appointments from './modules/patient/pages/Appointments';
import BookAppointment from './modules/patient/pages/BookAppointment';
import Records from './modules/patient/pages/Records';
import Results from './modules/patient/pages/Results';

// Pages praticien (US-18 à US-26)
import Disponibilites from './modules/practitioner/pages/Disponibilites';
import Agenda from './modules/practitioner/pages/Agenda';
import Patients from './modules/practitioner/pages/Patients';
import DossiersMedicaux from './modules/practitioner/pages/DossiersMedicaux';
import ComptesRendus from './modules/practitioner/pages/ComptesRendus';
import PublierResultats from './modules/practitioner/pages/PublierResultats';
// 3. Back-office administrateur (NOUVEAU)
import AdminDashboard from './modules/admin/pages/Admin';
import AdminUsers from './modules/admin/pages/AdminUsers';
import AdminCliniques from './modules/admin/pages/AdminCliniques';
import AdminAudit from './modules/admin/pages/AdminAudit';

// Pages admin
import AdminUsers from './modules/admin/pages/AdminUsers';
import AdminCliniques from './modules/admin/pages/AdminClinique';
import AdminAudit from './modules/admin/pages/AdminAudit';

// Protection : utilisateur connecté
function PrivateRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

// Réserve une route à certains rôles (NOUVEAU)
function RoleRoute({ roles, children }) {
    const { user } = useAuth();
    return roles.includes(user?.role) ? children : <Navigate to="/app" replace />;
}

// Chaque rôle a son propre tableau de bord sur /app (NOUVEAU)
function DashboardRouter() {
    const { user } = useAuth();
    return user?.role === 'admin' ? <AdminDashboard /> : <Dashboard />;
}

export default function App() {
    return (
        <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup-practitioner" element={<SignupPractitioner />} />

            {/* Routes protégées */}
            <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
                {/* On utilise DashboardRouter au lieu de Dashboard */}
                <Route index element={<DashboardRouter />} />

                <Route path="appointments" element={<Appointments />} />
                <Route path="records" element={<Records />} />
                <Route path="results" element={<Results />} />
                <Route path="disponibilites" element={<Disponibilites />} />  
                <Route path="agenda" element={<Agenda />} />                    
                <Route path="patients" element={<Patients />} />                
                <Route path="dossiers/:id" element={<DossiersMedicaux />} />        
                <Route path="comptes-rendus" element={<ComptesRendus />} />      
                <Route path="publier-resultats" element={<PublierResultats />} /> 

                {/* Routes Admin (NOUVEAU) */}
                <Route path="admin/users" element={<RoleRoute roles={['admin']}><AdminUsers /></RoleRoute>} />
                <Route path="admin/cliniques" element={<RoleRoute roles={['admin']}><AdminCliniques /></RoleRoute>} />
                <Route path="admin/audit" element={<RoleRoute roles={['admin']}><AdminAudit /></RoleRoute>} />
            </Route>

            {/* Pages inexistantes */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}