import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Users, BarChart3, Activity, TrendingUp, LogOut, User, UserCheck } from "lucide-react";
import { VCard } from "../../visionqc/VCard";
import { clearAuthToken, fetchUsers, getAuthUser } from "../../../lib/auth";
import { fetchAdminDiseasesByLocation, fetchAdminStatsOverview } from "../../../lib/admin";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";

const AdminDashboardCharts = lazy(() =>
  import("./AdminDashboardCharts").then((module) => ({ default: module.AdminDashboardCharts }))
);

function formatCompactNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

const adminNavItems = [
  { page: "web-admin-dashboard", label: "Dashboard", icon: <Activity className="w-5 h-5" />, isActive: true },
  { page: "web-manage-users", label: "Manage Users", icon: <Users className="w-5 h-5" /> },
  { page: "web-admin-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" /> },
];

export function WebAdminDashboard({ onNavigate }) {
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Admin User";
  const displayEmail = authUser?.email || "No email available";
  const displayRole = authUser?.role || "Admin";
  const [users, setUsers] = useState([]);
  const [statsOverview, setStatsOverview] = useState(null);
  const [diseasesByLocation, setDiseasesByLocation] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");

      const [usersResult, statisticsResult] = await Promise.allSettled([
        fetchUsers(),
        fetchAdminStatsOverview(),
      ]);

      const [diseasesByLocationResult] = await Promise.allSettled([
        fetchAdminDiseasesByLocation(),
      ]);

      if (isCancelled) {
        return;
      }

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      } else {
        setUsers([]);
      }

      if (statisticsResult.status === "fulfilled") {
        setStatsOverview(statisticsResult.value);
      } else {
        setStatsOverview(null);
      }

      if (diseasesByLocationResult.status === "fulfilled") {
        setDiseasesByLocation(diseasesByLocationResult.value);
      } else {
        setDiseasesByLocation([]);
      }

      if (usersResult.status === "rejected" && statisticsResult.status === "rejected") {
        setError("Failed to load admin dashboard data.");
      } else if (statisticsResult.status === "rejected") {
        setError("Admin overview statistics are unavailable, so some cards are using fallback data.");
      } else if (usersResult.status === "rejected") {
        setError("User list endpoint is unavailable, so some cards are using admin statistics only.");
      }

      setIsLoading(false);
    };

    loadDashboard();

    return () => {
      isCancelled = true;
    };
  }, []);

  const dashboardStats = useMemo(() => {
    const fallbackTotalUsers = users.length;
    const fallbackActiveUsers = users.filter((user) => user.status === "Active").length;
    const fallbackAdminUsers = users.filter((user) => String(user.role || "").toLowerCase() === "admin").length;
    const fallbackTotalScans = users.reduce((sum, user) => sum + (Number(user.scans) || 0), 0);
    const resolvedTotalUsers = statsOverview?.totalUsers ?? fallbackTotalUsers;
    const resolvedTotalScans = statsOverview?.totalScans ?? fallbackTotalScans;
    const resolvedAverageScansPerUser =
      resolvedTotalUsers > 0 ? resolvedTotalScans / resolvedTotalUsers : 0;

    return {
      totalUsers: resolvedTotalUsers,
      totalScans: resolvedTotalScans,
      activeUsers: statsOverview?.activeUsers ?? fallbackActiveUsers,
      adminUsers: fallbackAdminUsers,
      averageScansPerUser: resolvedAverageScansPerUser.toFixed(1),
      scansLast7Days: statsOverview?.scansLast7Days ?? 0,
    };
  }, [statsOverview, users]);

  const roleDistributionData = useMemo(() => {
    const adminUsers = users.filter((user) => String(user.role || "").toLowerCase() === "admin").length;
    const regularUsers = users.length - adminUsers;

    return [
      { name: "Admins", value: adminUsers, color: "#0d4d3d" },
      { name: "Regular Users", value: regularUsers, color: "#9ae66e" },
    ].filter((item) => item.value > 0);
  }, [users]);

  const statusDistributionData = useMemo(() => {
    const activeUsers = statsOverview?.activeUsers ?? users.filter((user) => user.status === "Active").length;
    const totalUsers = statsOverview?.totalUsers ?? users.length;
    const inactiveUsers = Math.max(totalUsers - activeUsers, 0);

    return [
      { name: "Active", value: activeUsers, color: "#6effc9" },
      { name: "Inactive", value: inactiveUsers, color: "#2a2d35" },
    ].filter((item) => item.value > 0);
  }, [statsOverview, users]);

  const diseaseByLocationData = useMemo(() => {
    return diseasesByLocation
      .map((item) => {
        const topDisease = Array.isArray(item.diseases) && item.diseases.length > 0
          ? item.diseases[0]
          : null;

        return {
          location: item.location,
          diseasedScans: topDisease?.count || 0,
          topDisease: topDisease?.disease || "Unknown disease",
        };
      })
      .filter((item) => item.diseasedScans > 0)
      .sort((left, right) => right.diseasedScans - left.diseasedScans)
      .slice(0, 6);
  }, [diseasesByLocation]);

  const topDiseasesData = useMemo(() => {
    return Array.isArray(statsOverview?.topDiseases)
      ? statsOverview.topDiseases.slice(0, 5).map((item) => ({
          name: item.disease,
          value: item.count,
        }))
      : [];
  }, [statsOverview]);

  const stats = [
    {
      label: "Total Users",
      value: formatCompactNumber(dashboardStats.totalUsers),
      icon: <Users />,
      gradient: "from-[#0d4d3d] to-[#0a6b52]",
    },
    {
      label: "Total Scans",
      value: formatCompactNumber(dashboardStats.totalScans),
      icon: <BarChart3 />,
      gradient: "from-[#9ae66e] to-[#6effc9]",
    },
    {
      label: "Active Users",
      value: formatCompactNumber(dashboardStats.activeUsers),
      icon: <UserCheck />,
      gradient: "from-[#6effc9] to-[#9ae66e]",
    },
    {
      label: "Avg. Scans / User",
      value: dashboardStats.averageScansPerUser,
      icon: <TrendingUp />,
      gradient: "from-[#2a2d35] to-[#0d4d3d]",
    },
  ];

  return (
    <AppShell
      homePage="web-admin-dashboard"
      onNavigate={onNavigate}
      brandSubtitle="Admin Panel"
      layoutClassName="relative z-10 flex h-screen"
      contentClassName="flex-1 overflow-auto p-8"
      navItems={adminNavItems}
      footerCard={<SessionCard name={displayName} email={displayEmail} role={displayRole} />}
      onLogout={() => {
        clearAuthToken();
        onNavigate("web-login");
      }}
      logoutIcon={<LogOut className="w-4 h-4" />}
    >
      <div className="mb-8">
        <h2 className="text-3xl text-[#0d4d3d] mb-1">Admin Dashboard</h2>
        <p className="text-[#2a2d35]/60">
          {isLoading
            ? "Loading live admin metrics..."
            : `${dashboardStats.adminUsers} admin${dashboardStats.adminUsers === 1 ? "" : "s"} managing ${dashboardStats.totalUsers} total user${dashboardStats.totalUsers === 1 ? "" : "s"}${dashboardStats.scansLast7Days ? ` - ${dashboardStats.scansLast7Days} scans in the last 7 days` : ""}`}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label}>
            <VCard variant="organic" className="!p-5">
              <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} text-white mb-4`}>
                {stat.icon}
              </div>
              <p className="text-3xl text-[#0d4d3d] mb-1">{isLoading ? "--" : stat.value}</p>
              <p className="text-sm text-[#2a2d35]/60">{stat.label}</p>
            </VCard>
          </div>
        ))}
      </div>

      {error && (
        <VCard variant="glass" className="mb-8">
          <p className="text-red-700">{error}</p>
        </VCard>
      )}

      <Suspense
        fallback={
          <VCard variant="organic" className="min-h-[360px] flex items-center justify-center">
            <p className="text-[#2a2d35]/60">Loading dashboard visuals...</p>
          </VCard>
        }
      >
        <AdminDashboardCharts
          isLoading={isLoading}
          roleDistributionData={roleDistributionData}
          statusDistributionData={statusDistributionData}
          topDiseasesData={topDiseasesData}
          diseaseByLocationData={diseaseByLocationData}
        />
      </Suspense>
    </AppShell>
  );
}
