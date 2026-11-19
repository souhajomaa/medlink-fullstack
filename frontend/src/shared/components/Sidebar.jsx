import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo-medlink.jpg';

// Navigation Patient
const patientNav = [
  { to: '/app', label: 'Tableau de bord', icon: '📊', description: "Vue d'ensemble" },
  { to: '/app/appointments', label: 'Mes rendez-vous', icon: '📅', description: 'Gérer mes RDV' },
  { to: '/app/book', label: 'Prendre RDV', icon: '➕', description: 'Nouveau rendez-vous' },
  { to: '/app/records', label: 'Dossier médical', icon: '📋', description: 'Mes documents' },
  { to: '/app/results', label: 'Mes résultats', icon: '🧪', description: 'Analyses & bilans' },
  { to: '/app/profile', label: 'Mon Profil', icon: '👤', description: 'Gérer mes informations' },
];

// Navigation Praticien
const practitionerNav = [
  { to: '/app', label: 'Tableau de bord', icon: '📊', description: "Vue d'ensemble" },
  { to: '/app/agenda', label: 'Agenda multi-sites', icon: '📅', description: 'Gérer les RDV' },
  { to: '/app/disponibilites', label: 'Mes disponibilités', icon: '⏰', description: 'Créneaux & absences' },
  { to: '/app/patients', label: 'Mes patients', icon: '🔍', description: 'Rechercher & consulter' },
  { to: '/app/records', label: 'Dossiers médicaux', icon: '📁', description: 'Historique complet' },
  { to: '/app/comptes-rendus', label: 'Comptes-rendus', icon: '📝', description: 'Rédiger & consulter' },
  { to: '/app/publier-resultats', label: 'Publier résultats', icon: '💉', description: 'Analyses & examens' },
];

// Navigation Administrateur
const adminNav = [
  { to: '/app', label: 'Tableau de bord', icon: '📊', description: "Vue d'ensemble" },
  { to: '/app/admin/users', label: 'Utilisateurs', icon: '👥', description: 'Gérer les utilisateurs' },
  { to: '/app/admin/cliniques', label: 'Cliniques', icon: '🏥', description: 'Gérer les cliniques' },
  { to: '/app/admin/audit', label: "Journal d'audit", icon: '🛡️', description: 'Consulter les actions' },
    { to: '/app/admin/rendez-vous', label: 'Rendez-vous', icon: '📅', description: 'Réserver pour un patient' },
    { to: '/app/admin/statistiques', label: 'Statistiques', icon: '📈', description: 'Synthèse et exports' },
    { to: '/app/admin/appels', label: 'Suivi des appels', icon: '📞', description: 'Baisse des appels' },
];

const navByRole = {
  patient: patientNav,
  practitioner: practitionerNav,
  admin: adminNav,
};

const roleLabel = {
  patient: 'Patient',
  practitioner: 'Praticien',
  admin: 'Administrateur',
};

export default function Sidebar() {
  const { user, logout } = useAuth();

  const nav = navByRole[user?.role] || patientNav;

  const displayRole =
    user?.role === 'practitioner'
      ? user?.specialty || roleLabel.practitioner
      : roleLabel[user?.role] || 'Patient';

  // Déconnexion
    const handleLogout = () => {
        logout();
    };
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-gray-200 bg-white shadow-sm">
      
      {/* Logo et titre */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
        <img
          src={logo}
          alt="MedLink Logo"
          className="h-12 w-auto rounded-lg object-contain"
        />
        <div>
          <h1 className="text-xl font-bold text-gray-900">MedLink</h1>
          <p className="text-xs text-gray-500">Espace sécurisé</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {user?.role === 'practitioner'
            ? 'Menu praticien'
            : user?.role === 'admin'
              ? 'Menu administrateur'
              : 'Menu principal'}
        </p>

        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'border border-teal-100 bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="text-2xl transition-transform group-hover:scale-110">
              {item.icon}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              <p className="truncate text-xs text-gray-400">{item.description}</p>
            </div>
          </NavLink>
        ))}
      </nav>

      {/* Profil + déconnexion */}
      <div className="border-t border-gray-100 bg-gray-50 p-4">
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-blue-600 text-lg font-bold text-white shadow-md">
              {user?.full_name?.charAt(0) || 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {user?.full_name}
              </p>
              <p className="truncate text-xs text-gray-500">{displayRole}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
        >
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
      
    </aside>
  );
}