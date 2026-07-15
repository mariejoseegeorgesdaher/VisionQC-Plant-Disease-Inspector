export const PAGE_PATHS = {
  "web-login": "/",
  "web-register": "/register",
  "web-forgot-password": "/forgot-password",
  "web-reset-password": "/reset-password",
  "web-dashboard": "/dashboard",
  "web-scan": "/scan",
  "web-history": "/history",
  "web-reminders": "/reminders",
  "web-edit-profile": "/profile",
  "web-admin-edit-profile": "/admin/profile",
  "web-plant-aliases": "/plant-aliases",
  "web-admin-dashboard": "/admin",
  "web-manage-users": "/admin/users",
};

export const DEFAULT_PAGE = "web-login";

export function resolvePathForPage(page) {
  return PAGE_PATHS[page] || PAGE_PATHS[DEFAULT_PAGE];
}
