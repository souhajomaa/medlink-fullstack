import keycloak from '../keycloak.js'; // Assurez-vous que le chemin est correct

const API_BASE = "/api";

function getToken() {
    return localStorage.getItem("medlink_token");
}

async function request(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    // 1. Priorité au token Keycloak s'il est authentifié
    if (keycloak && keycloak.authenticated) {
        try {
            await keycloak.updateToken(30);
            headers.Authorization = `Bearer ${keycloak.token}`;
        } catch (error) {
            console.error("Échec du rafraîchissement du token Keycloak :", error);
        }
    } else {
        // 2. Fallback sur le token localStorage (si utilisé en parallèle ou en transition)
        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.fields = data.fields || {};
    throw err;
}

    return data;
}

// Routes publiques : pas de token. On garde les erreurs par champ (err.fields).
async function publicPost(path, payload) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Erreur ${res.status}`);
        err.status = res.status;
        err.fields = data.fields || {};
        throw err;
    }
    return data;
}

const qs = (params = {}) => {
    const q = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return q ? `?${q}` : '';
};

// ================= HELPERS =================

const withBody = (method, body) => ({
    method,
    body: JSON.stringify(body),
});

// Rôle lu dans le token Keycloak (realm_access.roles)
function currentRole() {
    // Utilise l'instance importée directement, plus fiable que window.keycloak
    const roles = keycloak?.tokenParsed?.realm_access?.roles || [];
    return ['admin', 'practitioner', 'patient'].find((r) => roles.includes(r)) || null;
}

const byRole = (map) => (...args) => {
    const fn = map[currentRole()];
    if (!fn) return Promise.reject(new Error('Action non disponible pour votre rôle'));
    return fn(...args);
};

// ================= AUTH =================
const auth = {
    login: (email, password) =>
        publicPost("/auth/login", { email, password }),

    me: () => request("/auth/me"),

    register: (payload) =>
        publicPost("/auth/register", payload),

    practitionerOptions: () =>
        request("/auth/practitioner-options"),

    // Inscription directe d'un praticien (fonctionnalité de Hanen)
    registerPractitioner: (payload) =>
        publicPost("/auth/register-practitioner", payload),

    // Demande de création de compte praticien (fonctionnalité à conserver)
    requestPractitioner: (payload) =>
        request("/auth/practitioner-requests", withBody("POST", payload)),
};

// ================= PATIENT =================
const patient = {
    doctors: () => request("/patient/doctors"),
    practitioners: () => request("/patient/practitioners"),

    appointments: {
        list: () => request("/patient/appointments"),
        create: (data) => request("/patient/appointments", withBody("POST", data)),
        cancel: (id) => request(`/patient/appointments/${id}/cancel`, { method: "PATCH" }),
        reschedule: (id, data) => request(`/patient/appointments/${id}/reschedule`, withBody("PATCH", data)),
    },

    records: {
        list: () => request("/patient/records"),
        results: () => request("/patient/records/results"),
    },

    notifications: {
  list: () => request('/patient/notifications'),
  read: (id) => request(`/patient/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => request('/patient/notifications/read-all', { method: 'PATCH' }),
},
};

// ================= PRACTITIONER =================
const practitioner = {
    dashboard: () => request("/dashboard"),

    appointments: {
        list: () => request("/practitioner/appointments"),
        updateStatus: (id, status) =>
            request(`/practitioner/appointments/${id}`, withBody("PATCH", { status })),
    },

    disponibilites: {
        list: () => request("/practitioner/disponibilites"),
        create: (data) => request("/practitioner/disponibilites", withBody("POST", data)),
        remove: (id) => request(`/practitioner/disponibilites/${id}`, { method: "DELETE" }),
    },

    patients: {
        search: (q = "") => request(`/practitioner/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
        records: (id) => request(`/practitioner/patients/${id}/records`),
        results: (id) => request(`/practitioner/patients/${id}/results`),
        addRecord: (id, data) => request(`/practitioner/patients/${id}/records`, withBody("POST", data)),
        addResult: (id, data) => request(`/practitioner/patients/${id}/results`, withBody("POST", data)),
    },

    records: {
        list: () => request("/practitioner/records"),
        create: (data) => request("/practitioner/records", withBody("POST", data)),
    },

    results: {
        create: (data) => request("/practitioner/results", withBody("POST", data)),
    },
};

// ================= ADMIN =================
const admin = {
    stats: () => request("/admin/stats"),

    users: {
        list: (params) => request(`/admin/users${qs(params)}`),
        create: (data) => request("/admin/users", withBody("POST", data)),
        update: (id, data) => request(`/admin/users/${id}`, withBody("PATCH", data)),
        setStatus: (id, enabled) => request(`/admin/users/${id}/status`, withBody("PATCH", { enabled })),
        resetPassword: (id, password) => request(`/admin/users/${id}/reset-password`, withBody("POST", { password })),
        remove: (id, confirm_email) => request(`/admin/users/${id}`, withBody("DELETE", { confirm_email })),
        sync: () => request("/admin/users/sync", { method: "POST" }),
    },

    cliniques: {
        list: () => request("/admin/cliniques"),
        create: (data) => request("/admin/cliniques", withBody("POST", data)),
        update: (id, data) => request(`/admin/cliniques/${id}`, withBody("PUT", data)),
        remove: (id) => request(`/admin/cliniques/${id}`, { method: "DELETE" }),
        setPractitioners: (id, practitioner_ids) =>
            request(`/admin/cliniques/${id}/practitioners`, withBody("PUT", { practitioner_ids })),
    },

    audit: (params) => request(`/admin/audit${qs(params)}`),
};

// ================= API EXPORT =================
export const api = {
    // Modules de base
    auth,
    patient,
    practitioner,
    admin,
    dashboard: () => request("/dashboard"),

    // Raccourcis historiques
    register: auth.register,

    // Façades selon le rôle
    appointments: {
        list: byRole({ 
            patient: patient.appointments.list, 
            practitioner: practitioner.appointments.list 
        }),
        create: byRole({ patient: patient.appointments.create }),
        updateStatus: byRole({ practitioner: practitioner.appointments.updateStatus }),
        doctors: byRole({ patient: patient.doctors }),
    },
    records: {
        list: byRole({ 
            patient: patient.records.list, 
            practitioner: practitioner.records.list 
        }),
        results: byRole({ patient: patient.records.results }),
        create: byRole({ practitioner: practitioner.records.create }),
    },
};
// <-- L'accolade fermante en trop a été supprimée ici