import { useEffect, useMemo, useState } from "react";
import { Users, Search, Filter, LogOut, Activity, Ban, UserCheck, ShieldCheck, UserRound, User, Plus, Trash2 } from "lucide-react";
import { VCard } from "../../visionqc/VCard";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { BlobBackground } from "../../visionqc/BlobBackground";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "../../ui/table";
import { BrandLogo } from "../../visionqc/BrandLogo";
import { activateUser, changeUserRole, clearAuthToken, createUser, deactivateUser, deleteUser, fetchUsers, getAuthUser, updateUser } from "../../../lib/auth";
import { Eye, EyeOff } from "lucide-react";
export function WebManageUsers({ onNavigate }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editFullName, setEditFullName] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createFullName, setCreateFullName] = useState("");
    const [createEmail, setCreateEmail] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [createRole, setCreateRole] = useState("Regular");
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState(null);
    const authUser = useMemo(() => getAuthUser(), []);
    const displayName = authUser?.fullName || "Admin User";
    const displayEmail = authUser?.email || "No email available";
    const displayRole = authUser?.role || "Admin";
    
    const loadUsers = async () => {
        try {
            setError("");
            setIsLoading(true);
            const data = await fetchUsers();
            setUsers(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load users");
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        let isMounted = true;
        const loadUsersIfMounted = async () => {
            await loadUsers();
        };
        loadUsersIfMounted();
        return () => {
            isMounted = false;
        };
    }, []);
    const filteredUsers = users.filter((user) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return true;
        return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    });
    const openEditDialog = (user) => {
  if (editingUserId === user.id) {
    closeEditDialog();
    return;
  }

    setEditingUserId(user.id);
    setEditFullName(user.name);
    setEditPassword("");
    setActionMessage("");
  };
    const closeEditDialog = () => {
        setEditingUserId(null);
        setEditFullName("");
        setEditPassword("");
        setActionMessage("");
    };
    const resetCreateForm = () => {
        setCreateFullName("");
        setCreateEmail("");
        setCreatePassword("");
        setCreateRole("Regular");
        setShowCreatePassword(false);
    };
    const handleCreateUser = async (event) => {
        event.preventDefault();
        try {
            setIsSaving(true);
            setActionMessage("");
            await createUser({
                fullName: createFullName,
                email: createEmail,
                password: createPassword,
                role: createRole,
            });
            await loadUsers();
            resetCreateForm();
            setIsCreateOpen(false);
            setActionMessage("User created successfully.");
        }
        catch (err) {
            setActionMessage(err instanceof Error ? err.message : "Failed to create user");
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSaveEdit = async () => {
  if (!editingUserId) return;

  try {
    setIsSaving(true);
    setActionMessage("");

    const payload = { id: editingUserId };

    if (editFullName.trim() !== "") {
      payload.fullName = editFullName.trim();
    }

    if (editPassword.trim() !== "") {
      payload.newPassword = editPassword.trim();
    }

    await updateUser(payload);
    await loadUsers();
    closeEditDialog();
    setActionMessage("User updated successfully.");
  } catch (err) {
    setActionMessage(err instanceof Error ? err.message : "Failed to update user");
  } finally {
    setIsSaving(false);
  }
};
    const handleToggleStatus = async (user) => {
        try {
            setActionMessage("");
            if (user.status === "Active") {
                await deactivateUser(user.id);
            }
            else {
                await activateUser(user.id);
            }
            await loadUsers();
        }
        catch (err) {
            setActionMessage(err instanceof Error ? err.message : "Failed to update user status");
        }
    };
    const handleToggleRole = async (user) => {
        try {
            setActionMessage("");
            await changeUserRole({
                id: user.id,
                role: user.role === "Admin" ? "Regular" : "Admin",
            });
            await loadUsers();
        }
        catch (err) {
            setActionMessage(err instanceof Error ? err.message : "Failed to update user role");
        }
    };
    const handleDeleteUser = async (user) => {
        const confirmed = window.confirm(`Delete ${user.name}? This action cannot be undone.`);
        if (!confirmed)
            return;
        try {
            setActionMessage("");
            setDeletingUserId(user.id);
            await deleteUser(user.id);
            await loadUsers();
            setActionMessage("User deleted successfully.");
        }
        catch (err) {
            setActionMessage(err instanceof Error ? err.message : "Failed to delete user");
        }
        finally {
            setDeletingUserId(null);
        }
    };
    return (<div className="min-h-screen bg-gradient-to-br from-[#fafaf8] via-[#e8e3d8] to-[#fafaf8] relative overflow-hidden">
      <BlobBackground />

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <aside className="w-72 bg-white/60 backdrop-blur-md border-r-2 border-[#0d4d3d]/10 p-6">
          <button onClick={() => onNavigate("web-admin-dashboard")} className="w-full flex items-center gap-3 mb-12 text-left cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center">
              <BrandLogo className="w-7 h-7 object-contain"/>
            </div>
            <div>
              <h1 className="text-xl text-[#0d4d3d]">Vision QC</h1>
              <p className="text-xs text-[#2a2d35]/60">Admin Panel</p>
            </div>
          </button>

          <nav className="space-y-2 mb-12">
            <button onClick={() => onNavigate("web-admin-dashboard")} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[#0d4d3d]/5 text-[#2a2d35] transition-colors">
              <Activity className="w-5 h-5"/>
              <span>Dashboard</span>
            </button>
            <button onClick={() => onNavigate("web-manage-users")} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#0d4d3d] to-[#0a6b52] text-white">
              <Users className="w-5 h-5"/>
              <span>Manage Users</span>
            </button>
            <button onClick={() => onNavigate("web-admin-edit-profile")} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[#0d4d3d]/5 text-[#2a2d35] transition-colors">
              <User className="w-5 h-5"/>
              <span>Edit Info</span>
            </button>
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <VCard variant="glass" className="!p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#2a2d35]/70">Logged in as</p>
                <span className="px-2 py-0.5 rounded-full bg-[#9ae66e] text-[#0d4d3d] text-xs">{displayRole}</span>
              </div>
              <p className="text-sm text-[#0d4d3d]">{displayName}</p>
              <p className="text-xs text-[#2a2d35]/60">{displayEmail}</p>
            </VCard>
            <VButton variant="ghost" size="sm" className="w-full" onClick={() => {
                    clearAuthToken();
                    onNavigate("web-login");
                }}>
              <div className="flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4"/>
                <span>Logout</span>
              </div>
            </VButton>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl text-[#0d4d3d] mb-1">Manage Users</h2>
                <p className="text-[#2a2d35]/60">View and manage user accounts</p>
              </div>
              <VButton
                variant="primary"
                onClick={() => {
                  setIsCreateOpen((isOpen) => !isOpen);
                  setActionMessage("");
                }}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>{isCreateOpen ? "Close" : "Create User"}</span>
                </div>
              </VButton>
            </div>
          </div>

          {actionMessage && (<div className="mb-4 rounded-2xl border border-[#0d4d3d]/10 bg-white/70 px-4 py-3 text-sm text-[#0d4d3d] shadow-sm">
              {actionMessage}
            </div>)}

          {isCreateOpen && (
            <VCard variant="glass" className="mb-6">
              <form onSubmit={handleCreateUser}>
                <div className="mb-5">
                  <h3 className="text-xl text-[#0d4d3d] mb-1">Create User</h3>
                  <p className="text-sm text-[#2a2d35]/60">Add a new account and assign its initial role.</p>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr_180px] gap-4 items-end">
                  <VInput
                    label="Full Name"
                    value={createFullName}
                    onChange={(event) => setCreateFullName(event.target.value)}
                    placeholder="Enter full name"
                    disabled={isSaving}
                  />
                  <VInput
                    label="Email"
                    type="email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    placeholder="name@example.com"
                    disabled={isSaving}
                  />
                  <div>
                    <label className="block mb-2 text-[#2a2d35] opacity-80">Password</label>
                    <div className="relative">
                      <VInput
                        type={showCreatePassword ? "text" : "password"}
                        value={createPassword}
                        onChange={(event) => setCreatePassword(event.target.value)}
                        placeholder="Enter password"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2a2d35]/60 hover:text-[#0d4d3d]"
                        aria-label={showCreatePassword ? "Hide password" : "Show password"}
                      >
                        {showCreatePassword
                          ? <EyeOff className="w-5 h-5" />
                          : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-[#2a2d35] opacity-80">Role</label>
                    <select
                      value={createRole}
                      onChange={(event) => setCreateRole(event.target.value)}
                      disabled={isSaving}
                      className="w-full px-5 py-3 bg-white/80 backdrop-blur-sm border-2 border-[#0d4d3d]/10 rounded-3xl focus:outline-none focus:border-[#9ae66e] disabled:opacity-50"
                    >
                      <option value="Regular">Regular User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5">
                  <VButton
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      resetCreateForm();
                      setIsCreateOpen(false);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </VButton>
                  <VButton variant="primary" type="submit" disabled={isSaving}>
                    {isSaving ? "Creating..." : "Create User"}
                  </VButton>
                </div>
              </form>
            </VCard>
          )}

          {/* Search and Filter */}
          <VCard variant="glass" className="mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0d4d3d]/40"/>
                <input type="text" placeholder="Search users by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[#0d4d3d]/10 rounded-3xl
                    focus:outline-none focus:border-[#9ae66e] transition-all"/>
              </div>
              <button className="flex items-center gap-2 px-5 py-3 rounded-3xl bg-white/80 border-2 border-[#0d4d3d]/10 hover:border-[#9ae66e] transition-colors">
                <Filter className="w-5 h-5 text-[#0d4d3d]"/>
                <span className="text-[#0d4d3d]">Filter</span>
              </button>
            </div>
          </VCard>

          {/* Users Table */}
          <div>
            <VCard variant="organic">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (<TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-[#2a2d35]/60">
                        Loading users...
                      </TableCell>
                    </TableRow>)}
                  {!isLoading && error && (<TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-red-700">
                        {error}
                      </TableCell>
                    </TableRow>)}
                  {!isLoading && !error && filteredUsers.map((user) => (<tr key={user.id} className="border-b border-[#0d4d3d]/10 align-top">
                      <TableCell className="min-w-[320px]">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => openEditDialog(user)}
                            className="flex items-start gap-3 text-left cursor-pointer group"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0d4d3d] to-[#0a6b52] flex items-center justify-center text-white shrink-0">
                              {user.name[0]}
                            </div>
                            <span className="text-[#0d4d3d] transition-colors group-hover:text-[#0a6b52]">
                              {user.name}
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                              {editingUserId === user.id && (<div className="overflow-hidden">
                                  <div className="mt-4 rounded-[1.5rem] border border-white/40 bg-white/90 backdrop-blur-md shadow-lg p-4">
                                    <h3 className="text-lg text-[#0d4d3d] mb-1">Edit User</h3>
                                    <p className="text-sm text-[#2a2d35]/60 mb-4">{user.email}</p>

                                    <div className="space-y-3">
                                      <VInput
                                        label="Full Name"
                                        value={editFullName}
                                        onChange={(event) => setEditFullName(event.target.value)}
                                        placeholder="Enter full name"
                                      />
                                      <div>
                                        <label className="block mb-2 text-[#2a2d35] opacity-80">New Password</label>
                                         <div className="relative">
                                          <VInput
                                            type={showPassword ? "text" : "password"}
                                            value={editPassword}
                                            onChange={(event) => setEditPassword(event.target.value)}
                                            placeholder="Enter new password"
                                          />

                                          <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2a2d35]/60 hover:text-[#0d4d3d]"
                                          >
                                            {showPassword
                                              ? <EyeOff className="w-5 h-5" />
                                              : <Eye className="w-5 h-5" />}
                                          </button>
                                        </div>

                                        <p className="text-xs text-[#2a2d35]/55 mt-2">
                                          Leave empty to keep current password
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-4">
                                      <VButton variant="secondary" size="sm" onClick={closeEditDialog} disabled={isSaving}>
                                        Cancel
                                      </VButton>
                                      <VButton variant="primary" size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save Changes"}
                                      </VButton>
                                    </div>
                                  </div>
                                </div>)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#2a2d35]/70">{user.email}</TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs ${user.role === "Admin"
                ? "bg-[#9ae66e]/20 text-[#0d4d3d]"
                : "bg-[#0d4d3d]/10 text-[#2a2d35]"}`}>
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs ${user.status === "Active"
                ? "bg-[#6effc9]/20 text-[#0d4d3d]"
                : "bg-[#ef4444]/20 text-[#ef4444]"}`}>
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title={user.status === "Active" ? "Deactivate user" : "Activate user"}
                            aria-label={user.status === "Active" ? "Deactivate user" : "Activate user"}
                            onClick={() => handleToggleStatus(user)}
                            className="p-2 rounded-xl hover:bg-[#6effc9]/20 transition-colors"
                          >
                            {user.status === "Active" ? <Ban className="w-4 h-4 text-[#ef4444]"/> : <UserCheck className="w-4 h-4 text-[#0d4d3d]"/>}
                          </button>
                          <button
                            type="button"
                            title={user.role === "Admin" ? "Switch to Regular" : "Switch to Admin"}
                            aria-label={user.role === "Admin" ? "Switch to Regular" : "Switch to Admin"}
                            onClick={() => handleToggleRole(user)}
                            className="p-2 rounded-xl hover:bg-[#9ae66e]/20 transition-colors"
                          >
                            {user.role === "Admin" ? <UserRound className="w-4 h-4 text-[#0d4d3d]"/> : <ShieldCheck className="w-4 h-4 text-[#0d4d3d]"/>}
                          </button>
                          <button
                            type="button"
                            title="Delete user"
                            aria-label="Delete user"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.id}
                            className="p-2 rounded-xl hover:bg-[#ef4444]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4 text-[#ef4444]"/>
                          </button>
                        </div>
                      </TableCell>
                    </tr>))}
                  {!isLoading && !error && filteredUsers.length === 0 && (<TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-[#2a2d35]/60">
                        No users found.
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </VCard>
          </div>
        </main>
      </div>

    </div>);
}
