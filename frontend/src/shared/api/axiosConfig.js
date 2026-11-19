import keycloak from '../keycloak.js';

const API_BASE = "/api";

async function request(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    // Refresh the token if it expires in less than 30 seconds
    if (keycloak?.authenticated) {
        try {
            await keycloak.updateToken(30);
            headers.Authorization = `Bearer ${keycloak.token}`;
        } catch (error) {
            console.error("Session expirée, déconnexion forcée...");
            keycloak.logout({ redirectUri: window.location.origin + '/login' });
            return Promise.reject(error);
        }
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Backend says unauthorized while we think we're logged in -> force logout
    if (res.status === 401 && keycloak?.authenticated) {
        keycloak.logout({ redirectUri: window.location.origin + '/login' });
        throw new Error("Session expirée. Veuillez vous reconnecter.");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const err = new Error(data.error || `Erreur ${res.status}`);
        err.status = res.status;
        err.code = data.code;
        throw err;
    }
    return data; // must stay, otherwise /me returns undefined
}

// Download a file (e.g. CSV) with the same token as request()
async function download(path, filename) {
    const headers = {};
    if (keycloak?.authenticated) {
        await keycloak.updateToken(30);
        headers.Authorization = `Bearer ${keycloak.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Public routes: no token. Keep per-field errors (err.fields).
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
const withBody = (method, body) => ({ method, body: JSON.stringify(body) });

// Role read from the Keycloak token (realm_access.roles)
function currentRole() {
    const roles = keycloak?.tokenParsed?.realm_access?.roles || [];
    return ['admin', 'practitioner', 'patient'].find((r) => roles.includes(r)) || null;
}

const byRole = (map) => (...args) => {
    const fn = map[currentRole()];
    if (!fn) return Promise.reject(new Error('Action non disponible pour votre rôle'));
    return fn(...args);
};

// --- Module AUTH ---
const auth = {
    me: () => request('/auth/me'),
    register: (payload) => publicPost('/auth/register', payload),
    practitionerOptions: () => request('/auth/practitioner-options'),
    registerPractitioner: (payload) => publicPost('/auth/register-practitioner', payload),
    requestPractitioner: (payload) => request('/auth/practitioner-requests', withBody('POST', payload)),
};

// --- Module PATIENT ---
const patient = {
    practitioners: () => request('/patient/practitioners'),
    doctors: () => request('/patient/doctors'),
    appointments: {
        list: () => request('/patient/appointments'),
        create: (data) => request('/patient/appointments', withBody('POST', data)),
        cancel: (id) => request(`/patient/appointments/${id}/cancel`, { method: 'PATCH' }),
        reschedule: (id, data) =>
            request(`/patient/appointments/${id}/reschedule`, withBody('PATCH', data)),
    },
    cancel: (id) => request(`/patient/appointments/${id}/cancel`, { method: 'PATCH' }),
    records: {
        list: () => request('/patient/records'),
        results: () => request('/patient/records/results'),
        // récupéré du bloc dupliqué du merge (à vérifier : voir le message)
        downloadResult: (id) => request(`/patient/records/results/${id}/download`),
    },
    // récupéré du bloc dupliqué du merge
    updateProfile: (data) => request('/patient/profile', withBody('PUT', data)),
};

// --- Module PRACTITIONER ---
const practitioner = {
    dashboard: () => request('/dashboard'),
    appointments: {
        list: () => request('/practitioner/appointments'),
        updateStatus: (id, status) =>
            request(`/practitioner/appointments/${id}`, withBody('PATCH', { status })),
    },
    disponibilites: {
        list: () => request('/practitioner/disponibilites'),
        create: (data) => request('/practitioner/disponibilites', withBody('POST', data)),
        remove: (id) => request(`/practitioner/disponibilites/${id}`, { method: 'DELETE' }),
    },
    patients: {
        search: (q = '') =>
            request(`/practitioner/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
        records: (id) => request(`/practitioner/patients/${id}/records`),
        results: (id) => request(`/practitioner/patients/${id}/results`),
        addRecord: (id, data) =>
            request(`/practitioner/patients/${id}/records`, withBody('POST', data)),
        addResult: (id, data) =>
            request(`/practitioner/patients/${id}/results`, withBody('POST', data)),
    },
    records: {
        list: () => request('/practitioner/records'),
        create: (data) => request('/practitioner/records', withBody('POST', data)),
    },
    results: {
        create: (data) => request('/practitioner/results', withBody('POST', data)),
    },
};

// --- Module ADMIN ---
const admin = {
    stats: () => request('/admin/stats'),
    users: {
        list: (params) => request(`/admin/users${qs(params)}`),
        create: (data) => request('/admin/users', withBody('POST', data)),
        update: (id, data) => request(`/admin/users/${id}`, withBody('PATCH', data)),
        setStatus: (id, enabled) =>
            request(`/admin/users/${id}/status`, withBody('PATCH', { enabled })),
        resetPassword: (id, password) =>
            request(`/admin/users/${id}/reset-password`, withBody('POST', { password })),
        remove: (id, confirm_email) =>
            request(`/admin/users/${id}`, withBody('DELETE', { confirm_email })),
        sync: () => request('/admin/users/sync', { method: 'POST' }),
    },
    cliniques: {
        list: () => request('/admin/cliniques'),
        create: (data) => request('/admin/cliniques', withBody('POST', data)),
        update: (id, data) => request(`/admin/cliniques/${id}`, withBody('PUT', data)),
        remove: (id) => request(`/admin/cliniques/${id}`, { method: 'DELETE' }),
        setPractitioners: (id, practitioner_ids) =>
            request(`/admin/cliniques/${id}/practitioners`, withBody('PUT', { practitioner_ids })),
    },
    audit: (params) => request(`/admin/audit${qs(params)}`),

    // US-30: appointments booked on behalf of a patient
    patients: (q) => request(`/admin/patients${qs({ q })}`),
    bookingOptions: () => request('/admin/booking-options'),
    appointments: {
        list: (params) => request(`/admin/appointments${qs(params)}`),
        create: (data) => request('/admin/appointments', withBody('POST', data)),
        cancel: (id) => request(`/admin/appointments/${id}/cancel`, { method: 'PATCH' }),
    },

    // US-50: overview; US-32 / US-46: anonymized statistics
    synthese: (params) => request(`/admin/synthese${qs(params)}`),
    anonymizedStats: (params) => request(`/admin/stats/anonymized${qs(params)}`),
    exportStats: (params) =>
        download(
            `/admin/stats/export${qs(params)}`,
            `medlink-statistiques-anonymisees_${params.from}_${params.to}.csv`
        ),

    // US-51: tracking the drop in calls
    appels: {
        get: (params) => request(`/admin/appels${qs(params)}`),
        saveWeek: (data) => request('/admin/appels/semaine', withBody('PUT', data)),
        saveReference: (data) => request('/admin/appels/reference', withBody('PUT', data)),
    },
};

export const api = {
    auth,
    // historical shortcuts
    register: auth.register,
    patient,
    practitioner,
    admin,

    // role-based facades (used by Aya's pages)
    appointments: {
        list: byRole({ patient: patient.appointments.list, practitioner: practitioner.appointments.list }),
        create: byRole({ patient: patient.appointments.create }),
        updateStatus: byRole({ practitioner: practitioner.appointments.updateStatus }),
        doctors: byRole({ patient: patient.doctors }),
    },
    records: {
        list: byRole({ patient: patient.records.list, practitioner: practitioner.records.list }),
        results: byRole({ patient: patient.records.results }),
        create: byRole({ practitioner: practitioner.records.create }),
    },

    dashboard: () => request('/dashboard'),
};