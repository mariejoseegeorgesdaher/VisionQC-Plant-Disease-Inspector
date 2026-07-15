import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Scan, History, User, LogOut, Save, BarChart3, Leaf, Bell, Users } from "lucide-react";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { VCard } from "../../visionqc/VCard";
import { changeMyPassword, clearAuthToken, fetchCurrentUser, getAuthUser, updateMyProfile } from "../../../lib/auth";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";

export function WebEditProfile({ onNavigate }) {
  const location = useLocation();
  const authUser = useMemo(() => getAuthUser(), []);
  const isAdminRoute = location.pathname.startsWith("/admin/");
  const isAdminUser = (authUser?.role || "").trim().toLowerCase() === "admin";
  const isAdmin = isAdminRoute || isAdminUser;
  const displayRole = authUser?.role || (isAdmin ? "Admin" : "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFullName(authUser?.fullName || "");
    setEmail(authUser?.email || "");
  }, [authUser]);

  const { data: profile } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => fetchCurrentUser(),
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setEmail(profile.email || "");
    }
  }, [profile]);

  const navItems = isAdmin
    ? [
        { page: "web-admin-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
        { page: "web-manage-users", label: "Manage Users", icon: <Users className="w-5 h-5" /> },
        { page: "web-admin-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" />, isActive: true },
      ]
    : [
        { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
        { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" /> },
        { page: "web-history", label: "History", icon: <History className="w-5 h-5" /> },
        { page: "web-reminders", label: "Reminders", icon: <Bell className="w-5 h-5" /> },
        { page: "web-plant-aliases", label: "Plant Aliases", icon: <Leaf className="w-5 h-5" /> },
        { page: "web-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" />, isActive: true },
      ];

  const handleSaveChanges = async () => {
    const normalizedFullName = fullName.trim();
    const shouldChangePassword = currentPassword.trim() || newPassword.trim();

    if (!normalizedFullName) {
      setMessageType("error");
      setMessage("Full name is required.");
      return;
    }

    if (shouldChangePassword && !currentPassword.trim()) {
      setMessageType("error");
      setMessage("Current password is required to set a new password.");
      return;
    }

    if (shouldChangePassword && !newPassword.trim()) {
      setMessageType("error");
      setMessage("New password is required.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage("");

      await updateMyProfile({
        fullName: normalizedFullName,
      });

      if (shouldChangePassword) {
        await changeMyPassword({
          oldPassword: currentPassword,
          newPassword,
        });
      }

      setCurrentPassword("");
      setNewPassword("");
      setMessageType("success");
      setMessage(
        shouldChangePassword
          ? "Profile and password updated successfully."
          : "Profile updated successfully."
      );
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      homePage={isAdmin ? "web-admin-dashboard" : "web-dashboard"}
      onNavigate={onNavigate}
      brandSubtitle={isAdmin ? "Admin Panel" : "Plant Inspector"}
      navItems={navItems}
      footerCard={
        <SessionCard
          name={fullName || authUser?.fullName || "Vision QC User"}
          email={email || authUser?.email || "No email available"}
          role={displayRole}
        />
      }
      onLogout={() => {
        clearAuthToken();
        onNavigate("web-login");
      }}
      logoutIcon={<LogOut className="w-4 h-4" />}
    >
          <h2 className="text-3xl text-[#0d4d3d] mb-6">Edit Info</h2>

          <VCard variant="organic" className="max-w-2xl">
            <div className="space-y-4">
              {message && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    messageType === "error"
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-[#0d4d3d]/10 bg-white/70 text-[#0d4d3d]"
                  }`}
                >
                  {message}
                </div>
              )}
              <VInput label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <div>
                <VInput label="Email" value={email} disabled />
                <p className="mt-2 text-sm text-[#2a2d35]/60">Email cannot be changed.</p>
              </div>
              <VInput label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <VInput label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <VButton variant="primary" size="md" className="mt-2" onClick={handleSaveChanges} disabled={isSaving}>
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </div>
              </VButton>
            </div>
          </VCard>
    </AppShell>
  );
}
