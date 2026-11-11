import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />

          <div className="ml-72 flex flex-1 flex-col">
          <Navbar />

          <main className="flex-1 p-8">
            <Outlet />
          </main>

          <Footer />


        </div>
      </div>
  );
}