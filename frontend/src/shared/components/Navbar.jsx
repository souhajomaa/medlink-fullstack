import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-20 border-b border-outline-variant bg-white/95 px-8 py-5 backdrop-blur">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-2xl font-bold text-on-surface">
                        Bonjour, {user?.full_name?.split(' ')[0]} 👋
                    </h2>
                    <p className="mt-1 text-sm text-on-variant">
                        {new Date().toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-4">
          <span className="badge-info capitalize text-sm px-4 py-2">
            {{ patient: 'Patient', practitioner: 'Praticien', admin: 'Admin' }[user?.role] || 'Patient'}
          </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary font-semibold">
                        {user?.full_name?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>
        </header>
    );
}