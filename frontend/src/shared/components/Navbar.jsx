import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

export default function Navbar() {
  const { user } = useAuth();

  const roleLabel =
    user?.role === 'practitioner'
      ? 'Médecin'
      : user?.role === 'admin'
      ? 'Admin'
      : 'Patient';

  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-white/95 px-8 py-5 backdrop-blur">
      <div className="flex items-center justify-between">
        {/* ✅ Espace vide à gauche (le Dashboard gère le "Bonjour") */}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-on-surface">
            Espace {roleLabel}
          </h2>
          <p className="mt-1 text-sm text-on-variant">
            MedLink — Plateforme sécurisée
          </p>
        </div>

        {/* ✅ À droite : rôle et avatar */}
        <div className="flex shrink-0 items-center gap-4">
          {/* 🎯 US-20 : Cloche de notification visible uniquement pour les patients */}
          {user?.role === 'patient' && <NotificationBell />}
          <span className="badge-info text-sm px-4 py-2">{roleLabel}</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary font-semibold">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}