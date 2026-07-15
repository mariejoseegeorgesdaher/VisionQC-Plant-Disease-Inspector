import { apiRequest } from "./api";
import { getCachedOrLoad, invalidateCachePrefix } from "./cache";
import { invalidateAdminCache } from "./admin";

const loginEndpoint = import.meta.env.VITE_LOGIN_ENDPOINT || "/api/v1/auth/login";
const registerEndpoint =
  import.meta.env.VITE_REGISTER_ENDPOINT || "/api/v1/auth/register";
const forgotPasswordEndpoint =
  import.meta.env.VITE_FORGOT_PASSWORD_ENDPOINT || "/api/v1/auth/forgot-password";
const resetPasswordEndpoint =
  import.meta.env.VITE_RESET_PASSWORD_ENDPOINT || "/api/v1/auth/reset-password";
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
console.log("GOOGLE CLIENT ID FRONT =", googleClientId);
const googleLoginEndpoint =
  import.meta.env.VITE_GOOGLE_LOGIN_ENDPOINT || "/api/v1/auth/google/login";
const googleRegisterEndpoint =
  import.meta.env.VITE_GOOGLE_REGISTER_ENDPOINT || "/api/v1/auth/google/register";
const usersEndpoint = import.meta.env.VITE_USERS_ENDPOINT || "/api/v1/admin/users";
const adminUsersBaseEndpoint =
  import.meta.env.VITE_ADMIN_USERS_BASE_ENDPOINT || "/api/v1/admin/users";
const currentUserEndpoint =
  import.meta.env.VITE_CURRENT_USER_ENDPOINT || "/api/v1/users/me";
const currentUserPasswordEndpoint =
  import.meta.env.VITE_CURRENT_USER_PASSWORD_ENDPOINT || "/api/v1/users/me/password";

let googleScriptPromise = null;

function extractToken(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload.token ||
    payload.accessToken ||
    payload.jwt ||
    payload?.data?.token ||
    null
  );
}

function extractUserProfile(payload) {
  if (!payload || typeof payload !== "object") return null;

  const fullName =
    payload.fullName ||
    payload.name ||
    payload.user?.fullName ||
    payload.user?.name ||
    payload.data?.fullName ||
    payload.data?.name ||
    null;

  const email =
    payload.email ||
    payload.user?.email ||
    payload.data?.email ||
    null;

  const role =
    payload.role ||
    payload.user?.role ||
    payload.data?.role ||
    null;

  if (!fullName && !email && !role) return null;

  return {
    fullName: typeof fullName === "string" ? fullName : "",
    email: typeof email === "string" ? email : "",
    role: typeof role === "string" ? role : "",
  };
}

export function saveAuthToken(token) {
  if (token) localStorage.setItem("visionqc_token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("visionqc_token");
  localStorage.removeItem("visionqc_user");
  invalidateCachePrefix("auth:");
  invalidateCachePrefix("admin:");
  invalidateCachePrefix("plants:");
  invalidateCachePrefix("scans:");
}

export function saveAuthUser(profile) {
  if (!profile) return;
  localStorage.setItem("visionqc_user", JSON.stringify(profile));
}

export function getAuthUser() {
  const rawUser = localStorage.getItem("visionqc_user");
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem("visionqc_user");
    return null;
  }
}

export function getLandingPageForRole(role) {
  const normalizedRole = (role || "").trim().toLowerCase();
  return normalizedRole === "admin" ? "web-admin-dashboard" : "web-dashboard";
}

export function setAuthNotice(message) {
  if (message) sessionStorage.setItem("visionqc_auth_notice", message);
}

export function consumeAuthNotice() {
  const message = sessionStorage.getItem("visionqc_auth_notice");
  if (message) {
    sessionStorage.removeItem("visionqc_auth_notice");
  }
  return message || "";
}

export async function fetchCurrentUser() {
  return getCachedOrLoad("auth:current-user", async () => {
    const payload = await apiRequest(currentUserEndpoint, {
      method: "GET",
    });

    const profile = extractUserProfile(payload);
    if (profile) {
      saveAuthUser(profile);
    }

    return profile;
  });
}

export async function updateMyProfile({ fullName }) {
  const normalizedFullName = (fullName || "").trim();

  if (!normalizedFullName) {
    throw new Error("Full name is required");
  }

  await apiRequest(currentUserEndpoint, {
    method: "PATCH",
    body: JSON.stringify({
      fullName: normalizedFullName,
    }),
  });

  const existingUser = getAuthUser();
  const nextUser = {
    ...(existingUser || {}),
    fullName: normalizedFullName,
  };

  saveAuthUser(nextUser);
  invalidateCachePrefix("auth:");
  return nextUser;
}

export async function changeMyPassword({ oldPassword, newPassword }) {
  const normalizedOldPassword = oldPassword || "";
  const normalizedNewPassword = newPassword || "";

  if (!normalizedOldPassword) {
    throw new Error("Current password is required");
  }

  if (!normalizedNewPassword) {
    throw new Error("New password is required");
  }

  return apiRequest(currentUserPasswordEndpoint, {
    method: "PUT",
    body: JSON.stringify({
      oldPassword: normalizedOldPassword,
      newPassword: normalizedNewPassword,
    }),
  });
}

export function getGoogleClientId() {
  return googleClientId;
}

export function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google sign-in. Please try again.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google sign-in. Please try again."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function authenticateWithGoogle({ credential, mode = "login" }) {
  const targetEndpoint = mode === "register" ? googleRegisterEndpoint : googleLoginEndpoint;

  if (!googleClientId) {
    throw new Error(
      "Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to enable it."
    );
  }

  if (!credential) {
    throw new Error("Google sign-in did not return a valid credential.");
  }

  const payload = await apiRequest(targetEndpoint, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ idToken: credential }),
  });

  const token = extractToken(payload);
  if (token) saveAuthToken(token);
  saveAuthUser(extractUserProfile(payload));
  return payload;
}

export async function loginUser({ email, password }) {
  const normalizedEmail = (email || "").trim();
  const normalizedPassword = password || "";

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }
  if (!normalizedPassword) {
    throw new Error("Password is required");
  }

  const payload = await apiRequest(loginEndpoint, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
  });

  const token = extractToken(payload);
  if (token) saveAuthToken(token);
  const extractedProfile = extractUserProfile(payload);
  saveAuthUser({
    fullName: extractedProfile?.fullName || normalizedEmail.split("@")[0],
    email: extractedProfile?.email || normalizedEmail,
    role: extractedProfile?.role || "",
  });
  return payload;
}

export async function registerUser({ fullName, email, password }) {
  const normalizedFullName = (fullName || "").trim();
  const normalizedEmail = (email || "").trim();
  const normalizedPassword = password || "";
  const [firstName, ...rest] = normalizedFullName.split(/\s+/);
  const lastName = rest.join(" ");

  if (!normalizedFullName) {
    throw new Error("Full name is required");
  }
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }
  if (!normalizedPassword) {
    throw new Error("Password is required");
  }

  const payload = await apiRequest(registerEndpoint, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      firstName: firstName || "",
      lastName: lastName || "",
      fullName: normalizedFullName,
      email: normalizedEmail,
      password: normalizedPassword,
    }),
  });

  return payload;
}

export async function requestPasswordReset({ email }) {
  const normalizedEmail = (email || "").trim();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  return apiRequest(forgotPasswordEndpoint, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

export async function resetPassword({ email, token, newPassword }) {
  const normalizedEmail = (email || "").trim();
  const normalizedToken = (token || "").trim();
  const normalizedPassword = newPassword || "";

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (!normalizedToken) {
    throw new Error("Reset token is required");
  }

  if (!normalizedPassword) {
    throw new Error("New password is required");
  }

  return apiRequest(resetPasswordEndpoint, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      email: normalizedEmail,
      token: normalizedToken,
      newPassword: normalizedPassword,
    }),
  });
}

function normalizeUserRecord(user, index = 0) {
  if (!user || typeof user !== "object") {
    return {
      id: `user-${index}`,
      name: "Unknown User",
      email: "",
      role: "User",
      status: "Active",
      scans: 0,
    };
  }

  const fullName =
    user.fullName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Unknown User";

  const role = user.role || "User";
  const isActive =
    typeof user.isActive === "boolean"
      ? user.isActive
      : String(user.status || "").toLowerCase() !== "inactive";

  return {
    id: user.id || user.userId || `user-${index}`,
    name: fullName,
    email: user.email || "",
    role,
    status: isActive ? "Active" : "Inactive",
    scans:
      user.totalScans ??
      user.scanCount ??
      user.scans ??
      0,
  };
}

export async function fetchUsers() {
  return getCachedOrLoad("admin:users", async () => {
    const payload = await apiRequest(usersEndpoint, {
      method: "GET",
    });

    const rawUsers = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
      : Array.isArray(payload?.users)
        ? payload.users
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return rawUsers.map((user, index) => normalizeUserRecord(user, index));
  });
}

export async function createUser({ fullName, email, password, role = "Regular" }) {
  const normalizedFullName = (fullName || "").trim();
  const normalizedEmail = (email || "").trim();
  const normalizedPassword = password || "";
  const normalizedRole = role || "Regular";
  const [firstName, ...rest] = normalizedFullName.split(/\s+/);
  const lastName = rest.join(" ");

  if (!normalizedFullName) {
    throw new Error("Full name is required.");
  }

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  if (!normalizedPassword) {
    throw new Error("Password is required.");
  }

  const result = await apiRequest(adminUsersBaseEndpoint, {
    method: "POST",
    body: JSON.stringify({
      firstName: firstName || "",
      lastName: lastName || "",
      fullName: normalizedFullName,
      email: normalizedEmail,
      password: normalizedPassword,
      role: normalizedRole,
    }),
  });
  invalidateAdminCache();
  return result;
}

export async function updateUser({ id, fullName, newPassword }) {
  if (!id) {
    throw new Error("User id is required.");
  }

  const result = await apiRequest(`${adminUsersBaseEndpoint}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      fullName,
      newPassword,
    }),
  });
  invalidateAdminCache();
  return result;
}

export async function deleteUser(id) {
  if (!id) {
    throw new Error("User id is required.");
  }

  const result = await apiRequest(`${adminUsersBaseEndpoint}/${id}`, {
    method: "DELETE",
  });
  invalidateAdminCache();
  return result;
}

export async function activateUser(id) {
  if (!id) {
    throw new Error("User id is required.");
  }

  const result = await apiRequest(`${adminUsersBaseEndpoint}/${id}/activate`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  invalidateAdminCache();
  return result;
}

export async function deactivateUser(id) {
  if (!id) {
    throw new Error("User id is required.");
  }

  const result = await apiRequest(`${adminUsersBaseEndpoint}/${id}/deactivate`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  invalidateAdminCache();
  return result;
}

export async function changeUserRole({ id, role }) {
  if (!id) {
    throw new Error("User id is required.");
  }

  if (!role) {
    throw new Error("Role is required.");
  }

  const result = await apiRequest(`${adminUsersBaseEndpoint}/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  invalidateAdminCache();
  return result;
}
