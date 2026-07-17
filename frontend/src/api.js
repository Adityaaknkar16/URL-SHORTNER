const API_BASE = import.meta.env.VITE_API_URL || "/api";

const getHeaders = () => {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }
  return {
    "Content-Type": "application/json",
    "X-User-ID": userId,
  };
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
  }
  return res.json();
};

export const api = {
  getGroups: async () => {
    const res = await fetch(`${API_BASE}/groups`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  createGroup: async (name, color = "navy") => {
    const res = await fetch(`${API_BASE}/groups`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ name, color }),
    });
    return handleResponse(res);
  },

  archiveGroup: async (id, archived) => {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ archived }),
    });
    return handleResponse(res);
  },

  deleteGroup: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  getLinks: async () => {
    const res = await fetch(`${API_BASE}/links`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  shortenLink: async (data) => {
    const res = await fetch(`${API_BASE}/shorten`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteLink: async (id) => {
    const res = await fetch(`${API_BASE}/links/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  deleteLinksInGroup: async (groupId) => {
    const res = await fetch(`${API_BASE}/links/group/${groupId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
