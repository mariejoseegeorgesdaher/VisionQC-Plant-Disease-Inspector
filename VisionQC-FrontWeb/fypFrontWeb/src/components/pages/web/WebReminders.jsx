import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, History, Leaf, LogOut, MapPin, Scan, User, BarChart3, Clock3, CheckCircle2, AlertCircle } from "lucide-react";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";
import { VCard } from "../../visionqc/VCard";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { clearAuthToken, getAuthUser } from "../../../lib/auth";
import { fetchReminders } from "../../../lib/reminders";

function formatDateTime(value) {
  if (!value) return "Unknown";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReminderStatus(reminder) {
  if (!reminder.isEnabled) {
    return {
      label: "Disabled",
      badgeClassName: "bg-slate-100 text-slate-700",
      accentClassName: "text-slate-700",
    };
  }

  if (reminder.sentAt) {
    return {
      label: "Delivered",
      badgeClassName: "bg-emerald-100 text-emerald-800",
      accentClassName: "text-emerald-800",
    };
  }

  if (reminder.lastError) {
    return {
      label: "Needs Attention",
      badgeClassName: "bg-amber-100 text-amber-800",
      accentClassName: "text-amber-800",
    };
  }

  const dueDate = new Date(reminder.dueAt);
  if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= Date.now()) {
    return {
      label: "Due Now",
      badgeClassName: "bg-rose-100 text-rose-800",
      accentClassName: "text-rose-800",
    };
  }

  return {
    label: "Scheduled",
    badgeClassName: "bg-sky-100 text-sky-800",
    accentClassName: "text-sky-800",
  };
}

export function WebReminders({ onNavigate }) {
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Vision QC User";
  const displayEmail = authUser?.email || "No email available";
  const navItems = useMemo(
    () => [
      { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" />, isActive: false },
      { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" />, isActive: false },
      { page: "web-history", label: "History", icon: <History className="w-5 h-5" />, isActive: false },
      { page: "web-reminders", label: "Reminders", icon: <Bell className="w-5 h-5" />, isActive: true },
      { page: "web-plant-aliases", label: "Plant Aliases", icon: <Leaf className="w-5 h-5" />, isActive: false },
      { page: "web-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" />, isActive: false },
    ],
    []
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const {
    data: reminders = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => fetchReminders(),
  });

  useEffect(() => {
    setError(queryError instanceof Error ? queryError.message : "");
  }, [queryError]);

  const filteredReminders = reminders.filter((reminder) => {
    const query = searchFilter.trim().toLowerCase();
    const status = getReminderStatus(reminder).label.toLowerCase();
    const matchesSearch =
      !query ||
      [reminder.alias, reminder.location, reminder.disease]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "scheduled" && status === "scheduled") ||
      (statusFilter === "due" && status === "due now") ||
      (statusFilter === "delivered" && status === "delivered");

    return matchesSearch && matchesStatus;
  });

  const reminderStats = filteredReminders.reduce(
    (stats, reminder) => {
      const status = getReminderStatus(reminder).label;
      if (status === "Scheduled") stats.scheduled += 1;
      if (status === "Due Now") stats.due += 1;
      if (status === "Delivered") stats.delivered += 1;
      return stats;
    },
    { scheduled: 0, due: 0, delivered: 0 }
  );

  return (
    <AppShell
      homePage="web-dashboard"
      onNavigate={onNavigate}
      brandSubtitle="Plant Inspector"
      navItems={navItems}
      footerCard={<SessionCard name={displayName} email={displayEmail} />}
      onLogout={() => {
        clearAuthToken();
        onNavigate("web-login");
      }}
      logoutIcon={<LogOut className="w-4 h-4" />}
    >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl text-[#0d4d3d]">Reminders</h2>
              <p className="mt-2 text-[#2a2d35]/65">
                Track every re-scan reminder in one place, including what is scheduled, due soon, or already delivered.
              </p>
            </div>
            <VButton variant="accent" size="sm" onClick={() => onNavigate("web-scan")}>
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4" />
                <span>New Scan</span>
              </div>
            </VButton>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-4">
            <VCard variant="glass" className="!p-5">
              <p className="text-sm text-[#2a2d35]/60">Scheduled</p>
              <p className="mt-2 text-3xl text-[#0d4d3d]">{reminderStats.scheduled}</p>
            </VCard>
            <VCard variant="glass" className="!p-5">
              <p className="text-sm text-[#2a2d35]/60">Due Now</p>
              <p className="mt-2 text-3xl text-[#b42318]">{reminderStats.due}</p>
            </VCard>
            <VCard variant="glass" className="!p-5">
              <p className="text-sm text-[#2a2d35]/60">Delivered</p>
              <p className="mt-2 text-3xl text-[#0a6b52]">{reminderStats.delivered}</p>
            </VCard>
          </div>

          <div className="mb-4 max-w-4xl">
            <p className="mb-2 text-[#2a2d35] opacity-80">Find reminders by alias, disease, or location</p>
            <VInput
              placeholder="Type alias, disease, or location"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              icon={<Bell className="w-5 h-5" />}
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "all"
                  ? "bg-[#0d4d3d] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("scheduled")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "scheduled"
                  ? "bg-sky-700 text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              Scheduled
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("due")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "due"
                  ? "bg-[#b42318] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              Due Now
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("delivered")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "delivered"
                  ? "bg-[#0a6b52] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              Delivered
            </button>
          </div>

          <div className="space-y-4">
            {isLoading && (
              <VCard variant="glass">
                <p className="text-[#2a2d35]/70">Loading reminders...</p>
              </VCard>
            )}

            {!isLoading && error && (
              <VCard variant="glass">
                <p className="text-red-700">{error}</p>
              </VCard>
            )}

            {!isLoading && !error && filteredReminders.map((reminder) => {
              const status = getReminderStatus(reminder);

              return (
                <VCard
                  key={reminder.id}
                  data-testid={`reminder-card-${reminder.id}`}
                  aria-expanded={selectedReminderId === reminder.id}
                  variant="organic"
                  hover
                  onClick={() => setSelectedReminderId((currentId) => (currentId === reminder.id ? null : reminder.id))}
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xl text-[#0d4d3d]">{reminder.alias}</p>
                        <p className="mt-1 text-sm text-[#2a2d35]/70">{reminder.disease}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 ${status.badgeClassName}`}>
                          {status.label}
                        </span>
                        <span className="text-[#2a2d35]/60">
                          Due {formatDateTime(reminder.dueAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-y-2 text-sm text-[#2a2d35]/65">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        Scan {formatDateTime(reminder.scannedAt)}
                      </span>
                      <span className="inline-block w-4" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="w-4 h-4" />
                        {reminder.rescanDays > 0 ? `${reminder.rescanDays} day window` : "No window set"}
                      </span>
                      <span className="inline-block w-4" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {reminder.location || "No location"}
                      </span>
                    </div>

                    {selectedReminderId === reminder.id && (
                        <div className="overflow-hidden" data-testid={`reminder-details-${reminder.id}`}>
                          <div className="rounded-3xl border border-[#0d4d3d]/10 bg-white/65 p-5 shadow-sm">
                            <div className="grid gap-0 p-4 md:grid-cols-[220px_1fr]">
                              <div className="border-b md:border-b-0 md:border-r border-[#0d4d3d]/10 bg-white/50">
                                {reminder.imageUrl ? (
                                  <img
                                    src={reminder.imageUrl}
                                    alt={reminder.alias}
                                    className="h-full min-h-52 w-full object-cover rounded-t-2xl md:rounded-t-none md:rounded-l-2xl"
                                  />
                                ) : (
                                  <div className="flex min-h-52 items-center justify-center text-[#2a2d35]/45">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="p-5">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3">
                                    <p className="text-sm text-[#2a2d35]/60">Due Date</p>
                                    <p className={`mt-1 ${status.accentClassName}`}>{formatDateTime(reminder.dueAt)}</p>
                                  </div>
                                  <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3">
                                    <p className="text-sm text-[#2a2d35]/60">Scan Date</p>
                                    <p className="mt-1 text-[#0d4d3d]">{formatDateTime(reminder.scannedAt)}</p>
                                  </div>
                                  <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3">
                                    <p className="text-sm text-[#2a2d35]/60">Rescan Window</p>
                                    <p className="mt-1 text-[#0d4d3d]">
                                      {reminder.rescanDays > 0 ? `${reminder.rescanDays} days` : "Not set"}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3">
                                    <p className="text-sm text-[#2a2d35]/60">Location</p>
                                    <p className="mt-1 text-[#0d4d3d]">{reminder.location || "No location"}</p>
                                  </div>
                                </div>

                                <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                                  <div className="rounded-2xl border border-[#0d4d3d]/10 bg-white/65 px-4 py-4">
                                    <div className="flex items-center gap-2 text-[#2a2d35]/60">
                                      <Calendar className="w-4 h-4" />
                                      <p className="text-sm uppercase tracking-wide">Follow-up reason</p>
                                    </div>
                                    <p className="mt-3 text-[#0d4d3d]">
                                      {reminder.rescanReason || "This scan is scheduled for a follow-up re-scan."}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-[#0d4d3d]/10 bg-white/65 px-4 py-4 space-y-3">
                                    <div className="flex items-center gap-2 text-[#2a2d35]/60">
                                      <Clock3 className="w-4 h-4" />
                                      <p className="text-sm uppercase tracking-wide">Notification Details</p>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                      <p className="flex items-start gap-2 text-[#0d4d3d]">
                                        <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" />
                                        <span>Enabled: {formatDateTime(reminder.enabledAt)}</span>
                                      </p>
                                      <p className="flex items-start gap-2 text-[#0d4d3d]">
                                        <Bell className="mt-0.5 w-4 h-4 shrink-0" />
                                        <span>Delivered: {reminder.sentAt ? formatDateTime(reminder.sentAt) : "Not yet delivered"}</span>
                                      </p>
                                      {reminder.lastError && (
                                        <p className="flex items-start gap-2 text-amber-800">
                                          <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
                                          <span>{reminder.lastError}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </VCard>
              );
            })}

            {!isLoading && !error && filteredReminders.length === 0 && (
              <VCard variant="glass">
                <p className="text-[#2a2d35]/70">
                  {reminders.length === 0
                    ? "No reminders have been saved yet. Enable one from a scan result to see it here."
                    : "No reminders match the current filters."}
                </p>
              </VCard>
            )}
            {!isLoading && notice && !error && (
              <VCard variant="glass">
                <p className="text-[#0d4d3d]">{notice}</p>
              </VCard>
            )}
          </div>
    </AppShell>
  );
}
