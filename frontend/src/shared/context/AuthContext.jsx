import {
  createContext,
  useCallback,
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

const MFA_RETRY_KEY = 'medlink-mfa-retry';

const readSession = (key) => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};
const writeSession = (key, value) => {
  try { sessionStorage.setItem(key, value); } catch { /* ignoré */ }
};
const clearSession = (key) => {
  try { sessionStorage.removeItem(key); } catch { /* ignoré */ }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const logoutInProgress = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const authenticated = await initKeycloakOnce();
        // TRACE TEMPORAIRE (à retirer une fois la boucle comprise)
        console.log('[auth] 1. init Keycloak : authenticated =', authenticated);

        if (authenticated) {
          clearSession('medlink-login-attempt');
          const profile = await api.auth.me();
                    if (!profile || !profile.role) {
            throw new Error("Profil utilisateur illisible (réponse vide de l'API)");
          }
          console.log('[auth] 2. /me OK, rôle =', profile.role);

          clearSession(MFA_RETRY_KEY);
          if (mounted) {
            setUser(profile);
            setAuthError(null);
          }
        }
      } catch (error) {
        console.error('[auth] 2. ÉCHEC :', error.status, error.code, error.message);

        // MFA (US-17, US-34) : TOTP non configuré -> on ferme la session SSO une seule fois,
        // Keycloak demandera la configuration à la prochaine connexion.
        // Au 2e échec on affiche l'erreur : jamais de boucle.
        if (error.code === 'MFA_REQUIRED' && readSession(MFA_RETRY_KEY) !== '1') {
          writeSession(MFA_RETRY_KEY, '1');
          clearSession('medlink-login-attempt');
          await keycloak
            .logout({ redirectUri: window.location.origin + '/login' })
            .catch(() => {});
          return; // la page quitte l'application : on ne touche plus à l'état
        }

        if (mounted) {
          setUser(null);
          setAuthError(error.message || 'Erreur de connexion');
        }
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

  const logout = useCallback(async () => {
  console.warn('[auth] logout() appelé par :', new Error().stack);

  if (logoutInProgress.current) return;
  logoutInProgress.current = true;

  // Empêche Login.jsx de considérer cette arrivée comme une tentative
  // de connexion automatique précédente.
  clearSession('medlink-login-attempt');

  // Indique à Login.jsx que le retour vers /login vient d'un logout.
  sessionStorage.setItem('medlink-logout', '1');

  // On vide immédiatement l'utilisateur côté React.
  setUser(null);

  try {
    await keycloak.logout({
      redirectUri: window.location.origin + '/login',
    });
  } catch (error) {
    logoutInProgress.current = false;
    sessionStorage.removeItem('medlink-logout');
    throw error;
  }
}, []);

  // US-40 : déconnexion après 15 min d'inactivité.
  // Le hook est appelé ici, au premier niveau du composant, et jamais dans logout().
  const onIdle = useCallback(() => {
    logout().catch(() => {});
  }, [logout]);

  useIdleLogout(!!user, onIdle);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        authError,
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
