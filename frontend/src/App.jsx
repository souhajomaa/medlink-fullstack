
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './shared/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './shared/components/Layout';

// Pages publiques
import Landing from './shared/pages/Landing';
import Login from './modules/auth/pages/Login';
import Signup from './modules/auth/pages/Signup';
import SignupPractitioner from './modules/auth/pages/SignupPractitioner';

// Pages patient
import Dashboard from './shared/pages/Dashboard';
import Appointments from './modules/patient/pages/Appointments';
import BookAppointment from './modules/patient/pages/BookAppointment';
import MedicalRecords from './modules/patient/pages/MedicalRecords';
import Results from './modules/patient/pages/Results';
import Profile from './modules/patient/pages/Profile';

// Pages praticien
import Disponibilites from './modules/practitioner/pages/Disponibilites';
import Agenda from './modules/practitioner/pages/Agenda';
import Patients from './modules/practitioner/pages/Patients';
import DossiersMedicaux from './modules/practitioner/pages/DossiersMedicaux';
import ComptesRendus from './modules/practitioner/pages/ComptesRendus';
import PublierResultats from './modules/practitioner/pages/PublierResultats';

// Pages administrateur
import AdminDashboard from './modules/admin/pages/Admin';
import AdminUsers from './modules/admin/pages/AdminUsers';
import AdminCliniques from './modules/admin/pages/AdminCliniques';
import AdminAudit from './modules/admin/pages/AdminAudit';
import AdminRendezVous from './modules/admin/pages/AdminRendezVous';
import AdminStats from './modules/admin/pages/AdminStats';
import AdminAppels from './modules/admin/pages/AdminAppels';

// Protection : utilisateur connecté
function PrivateRoute({ children }) {
    const { user, loading, authError, logout } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!user && authError) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
                <h1 className="text-xl font-bold">Connexion impossible</h1>
                <p className="max-w-md text-sm text-on-variant">{authError}</p>
                <button
                    className="btn-primary"
                    onClick={() => logout().catch(() => {})}
                >
                    Se déconnecter
                </button>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

// Protection : route réservée à certains rôles
function RoleRoute({ roles, children }) {
    const { user } = useAuth();

    return roles.includes(user?.role)
        ? children
        : <Navigate to="/app" replace />;
}

// Tableau de bord adapté au rôle
function DashboardRouter() {
    const { user } = useAuth();

    if (user?.role === 'admin') {
        return <AdminDashboard />;
    }

    return <Dashboard />;
}

// Dossiers : patient voit ses dossiers, praticien voit ses patients
function RecordsRouter() {
    const { user } = useAuth();

    if (user?.role === 'patient') {
        return <MedicalRecords />;
    }

    if (user?.role === 'practitioner') {
        return <Patients />;
    }

    return <Navigate to="/app" replace />;
}

export default function App() {
    return (
        <>
            <Toaster position="top-right" />

            <Routes>
                {/* Routes publiques */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route
                    path="/signup-practitioner"
                    element={<SignupPractitioner />}
                />

                {/* Routes protégées */}
                <Route
                    path="/app"
                    element={
                        <PrivateRoute>
                            <Layout />
                        </PrivateRoute>
                    }
                >
                    <Route index element={<DashboardRouter />} />

                    {/* Commun à tous les utilisateurs connectés */}
                    <Route path="profile" element={<Profile />} />

                    {/* Patient et praticien */}
                    <Route
                        path="appointments"
                        element={
                            <RoleRoute roles={['patient', 'practitioner']}>
                                <Appointments />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="records"
                        element={
                            <RoleRoute roles={['patient', 'practitioner']}>
                                <RecordsRouter />
                            </RoleRoute>
                        }
                    />

                    {/* Patient uniquement */}
                    <Route
                        path="book"
                        element={
                            <RoleRoute roles={['patient']}>
                                <BookAppointment />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="results"
                        element={
                            <RoleRoute roles={['patient']}>
                                <Results />
                            </RoleRoute>
                        }
                    />

                    {/* Praticien uniquement */}
                    <Route
                        path="disponibilites"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <Disponibilites />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="agenda"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <Agenda />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="patients"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <Patients />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="dossiers/:id"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <DossiersMedicaux />
                            </RoleRoute>
                        }
                    />

                    {/* Alias conservé pour les anciens liens */}
                    <Route
                        path="records/:id"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <DossiersMedicaux />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="comptes-rendus"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <ComptesRendus />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="publier-resultats"
                        element={
                            <RoleRoute roles={['practitioner']}>
                                <PublierResultats />
                            </RoleRoute>
                        }
                    />

                    {/* Administrateur uniquement */}
                    <Route
                        path="admin/users"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminUsers />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="admin/cliniques"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminCliniques />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="admin/audit"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminAudit />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="admin/rendez-vous"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminRendezVous />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="admin/statistiques"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminStats />
                            </RoleRoute>
                        }
                    />

                    <Route
                        path="admin/appels"
                        element={
                            <RoleRoute roles={['admin']}>
                                <AdminAppels />
                            </RoleRoute>
                        }
                    />

                    {/* Route /app inconnue */}
                    <Route
                        path="*"
                        element={<Navigate to="/app" replace />}
                    />
                </Route>

                {/* Route globale inconnue */}
                <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                />
            </Routes>
        </>
    );
}
