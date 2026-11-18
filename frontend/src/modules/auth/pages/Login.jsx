import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import logo from '../../../shared/assets/logo-medlink.jpg';

// Drapeau « on vient de t'envoyer vers Keycloak » (propre à l'onglet).
// Il évite la boucle : Keycloak → bouton Retour → /login → Keycloak → ...
// Au retour, on affiche la page manuelle au lieu de renvoyer aussitôt.
const FLAG = 'medlink-login-attempt';
const LOGOUT_FLAG = 'medlink-logout';

const readFlag = () => {
  try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; }
};
const setFlag = () => {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* ignoré */ }
};
const clearFlag = () => {
  try { sessionStorage.removeItem(FLAG); } catch { /* ignoré */ }
};

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [manual, setManual] = useState(false);
  const started = useRef(false);

  useEffect(() => {
  if (loading) return;

  // Utilisateur déjà connecté
  if (user) {
    clearFlag();
    sessionStorage.removeItem(LOGOUT_FLAG);
    navigate('/app', { replace: true });
    return;
  }

  if (started.current) return;
  started.current = true;

  // Retour après une déconnexion volontaire :
  // ne pas relancer automatiquement Keycloak.
  if (sessionStorage.getItem(LOGOUT_FLAG) === '1') {
    sessionStorage.removeItem(LOGOUT_FLAG);
    clearFlag();
    setManual(true);
    return;
  }

  // Retour depuis Keycloak avec le bouton "Retour"
  if (readFlag()) {
    clearFlag();
    setManual(true);
    return;
  }

  // Première arrivée sur /login :
  // connexion automatique via Keycloak.
  setFlag();

  login().catch((error) => {
    console.error('Erreur de connexion :', error);
    clearFlag();
    setManual(true);
  });
}, [user, loading, login, navigate]);

  // Page restaurée depuis le cache du navigateur (bouton Retour) : mode manuel.
  useEffect(() => {
    const onShow = (e) => {
      if (e.persisted) {
        clearFlag();
        setManual(true);
      }
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const handleLogin = () => {
    login().catch((error) => console.error('Erreur de connexion :', error));
  };

  if (!manual) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-low">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-on-variant">Redirection vers la connexion sécurisée…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
        <img src={logo} alt="MedLink" className="w-24 mx-auto mb-6" />

        <h1 className="text-2xl font-bold mb-3">Bienvenue sur MedLink</h1>

        <p className="text-gray-600 mb-8">
          Connectez-vous pour accéder à votre espace sécurisé.
        </p>

        <button onClick={handleLogin} className="btn-primary w-full py-3">
          Se connecter
        </button>

        <p className="text-sm text-gray-600 mt-6">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
