const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("medlink_token");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

const qs = (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    return q ? `?${q}` : '';
};
const withBody = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  // --- Module AUTH ---
  auth: {
    login: (email, password) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request("/auth/me"),
  },

  // --- Module PATIENT ---
  patient: {
    practitioners: () => request("/patient/practitioners"),

    appointments: {
      list: () => request("/patient/appointments"),
      create: (data) =>
        request("/patient/appointments", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      cancel: (id) =>
        request(`/patient/appointments/${id}/cancel`, {
          method: "PATCH",
        }),

      reschedule: (id, data) =>
        request(`/patient/appointments/${id}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
    },

    cancel: (id) =>
      request(`/patient/appointments/${id}/cancel`, {
        method: "PATCH",
      }),

    records: {
      list: () => request("/patient/records"),
      results: () => request("/patient/records/results"),
    },
  },

  // --- Module PRACTITIONER ---
  practitioner: {
    appointments: {
      list: () => request("/practitioner/appointments"),
      updateStatus: (id, status) =>
        request(`/practitioner/appointments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
    },

      // --- Module admin
      admin: {
          stats: () => request('/admin/stats'),
          users: {
              list: (params) => request(`/admin/users${qs(params)}`),
              create: (data) => request('/admin/users', withBody('POST', data)),
              update: (id, data) => request(`/admin/users/${id}`, withBody('PATCH', data)),
              setStatus: (id, enabled) => request(`/admin/users/${id}/status`, withBody('PATCH', { enabled })),
              resetPassword: (id, password) => request(`/admin/users/${id}/reset-password`, withBody('POST', { password })),
              remove: (id, confirm_email) => request(`/admin/users/${id}`, withBody('DELETE', { confirm_email })),
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
      },
    records: {
      list: () => request("/practitioner/records"),
      create: (data) =>
        request("/practitioner/records", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
  },

  // --- Fallback Dashboard ---
  dashboard: () => request("/dashboard"),
};
