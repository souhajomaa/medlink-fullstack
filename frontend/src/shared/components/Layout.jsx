
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import SessionTimeout from './SessionTimeout';

export default function Layout() {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Erreur lors de la déconnexion :', error);
        }
    };

    return (
        <div className="flex min-h-screen bg-surface">
            <SessionTimeout />

            <Sidebar />

            <div className="ml-72 flex min-w-0 flex-1 flex-col">
                <Navbar onLogout={handleLogout} />

                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>

                <Footer />
            </div>
        </div>
    );
}
