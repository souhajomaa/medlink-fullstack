import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

import { api } from '../api/axiosConfig';
import keycloak from '../keycloak.js';
import { useIdleLogout } from '../hooks/useIdleLogout.js';

const AuthContext = createContext(null);

// keycloak.init() ne peut être appelé qu'une seule fois par instance.
// En développement, React.StrictMode exécute les effets deux fois :
// on partage donc la même promesse d'initialisation entre les deux exécutions.
let keycloakInitPromise = null;

function initKeycloakOnce() {
  if (!keycloakInitPromise) {
    keycloakInitPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  }
  return keycloakInitPromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutInProgress = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const authenticated = await initKeycloakOnce();

        if (authenticated) {
          try { sessionStorage.removeItem('medlink-login-attempt'); } catch { /* ignoré */ }
          const profile = await api.auth.me();

          if (mounted) {
            setUser(profile);
          }
        }
      } catch (error) {
        console.error('Erreur Keycloak :', error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async () => {
    await keycloak.login({
      redirectUri: window.location.origin + '/app',
    });
  };

  const logout = async () => {
  if (logoutInProgress.current) return;

  logoutInProgress.current = true;
  setUser(null);

  try {
    sessionStorage.setItem('medlink-logout', '1');

    await keycloak.logout({
      redirectUri: window.location.origin + '/login',
    });
  } catch (error) {
    logoutInProgress.current = false;
    sessionStorage.removeItem('medlink-logout');
    throw error;
  }
};

  // US-40 : déconnexion après 15 min d'inactivité.
  // Le hook est appelé ici, au premier niveau du composant, et jamais dans logout().
  useIdleLogout(!!user, () => {
    logout().catch(() => {});
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth doit être utilisé à l’intérieur d’un AuthProvider'
    );
  }

  return context;
}
