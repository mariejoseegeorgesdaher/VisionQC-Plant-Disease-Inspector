import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scan, History, User, LogOut, MapPin, TrendingUp, Activity, AlertCircle, BarChart3, Leaf, Bell } from "lucide-react";
import { VCard } from "../../visionqc/VCard";
import { PlantCard } from "../../visionqc/PlantCard";
import { clearAuthToken, getAuthUser } from "../../../lib/auth";
import { fetchScanHistory } from "../../../lib/scans";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";

const selectedHistoryScanStorageKey = "visionqc_selected_history_scan_id";
const historyStatusFilterStorageKey = "visionqc_history_status_filter";
const historyDateFilterStorageKey = "visionqc_history_date_filter";

function formatDate(value) {
  if (!value) return "Unknown date";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isHealthyScan(scan) {
  const disease = (scan?.disease || "").trim().toLowerCase();
  if (!disease) {
    return false;
  }

  if (disease.includes("no plant")) {
    return false;
  }

  return (
    disease === "healthy" ||
    disease === "healthy plant" ||
    disease === "no disease" ||
    disease === "none" ||
    disease.includes("healthy") ||
    disease.includes("no disease detected") ||
    disease.includes("no obvious disease detected")
  );
}

export function WebDashboard({ onNavigate }) {
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Vision QC User";
  const displayEmail = authUser?.email || "No email available";
  const {
    data: historyItems = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => fetchScanHistory(),
  });

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let healthyPlants = 0;
    let diseasesFound = 0;
    let monthlyScans = 0;
    const uniqueLocations = new Set();

    historyItems.forEach((item) => {
      if (isHealthyScan(item)) {
        healthyPlants += 1;
      } else {
        diseasesFound += 1;
      }

      if (item.location) {
        uniqueLocations.add(item.location.trim().toLowerCase());
      }

      const scannedDate = new Date(item.scannedAt);
      if (!Number.isNaN(scannedDate.getTime()) && scannedDate.getMonth() === currentMonth && scannedDate.getFullYear() === currentYear) {
        monthlyScans += 1;
      }
    });

    return {
      totalScans: historyItems.length,
      healthyPlants,
      diseasesFound,
      monthlyScans,
      locationCount: uniqueLocations.size,
    };
  }, [historyItems]);

  const recentScans = useMemo(() => {
    return [...historyItems]
      .sort((left, right) => {
        const leftTime = new Date(left.scannedAt).getTime();
        const rightTime = new Date(right.scannedAt).getTime();

        if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
        if (Number.isNaN(leftTime)) return 1;
        if (Number.isNaN(rightTime)) return -1;

        return rightTime - leftTime;
      })
      .slice(0, 4)
      .map((scan) => ({
        id: scan.id,
        image: scan.imageUrl,
        alias: scan.alias,
        disease: scan.disease || "Unknown",
        severityLevel: scan.severityLevel || "",
        date: formatDate(scan.scannedAt),
        location: scan.location,
      }));
  }, [historyItems]);

  const stats = useMemo(() => [
    {
      label: "Total Scans",
      value: dashboardStats.totalScans,
      icon: <Scan />,
      gradient: "from-[#0d4d3d] to-[#0a6b52]",
    },
    {
      label: "Healthy Plants",
      value: dashboardStats.healthyPlants,
      icon: <TrendingUp />,
      gradient: "from-[#9ae66e] to-[#6effc9]",
    },
    {
      label: "Diseases Found",
      value: dashboardStats.diseasesFound,
      icon: <AlertCircle />,
      gradient: "from-[#ef4444] to-[#dc2626]",
    },
    {
      label: "This Month",
      value: dashboardStats.monthlyScans,
      icon: <Activity />,
      gradient: "from-[#6effc9] to-[#9ae66e]",
    },
  ], [dashboardStats]);

  const navItems = useMemo(() => ([
    { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" />, isActive: true },
    { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" /> },
    { page: "web-history", label: "History", icon: <History className="w-5 h-5" /> },
    { page: "web-reminders", label: "Reminders", icon: <Bell className="w-5 h-5" /> },
    { page: "web-plant-aliases", label: "Plant Aliases", icon: <Leaf className="w-5 h-5" /> },
    { page: "web-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" /> },
  ]), []);

  const handleOpenRecentScan = (scanId) => {
    if (typeof window !== "undefined" && scanId) {
      window.sessionStorage.removeItem(historyStatusFilterStorageKey);
      window.sessionStorage.removeItem(historyDateFilterStorageKey);
      window.sessionStorage.setItem(selectedHistoryScanStorageKey, String(scanId));
    }

    onNavigate("web-history");
  };

  const handleOpenHistoryWithFilter = (statusFilter) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(selectedHistoryScanStorageKey);
      window.sessionStorage.removeItem(historyDateFilterStorageKey);

      if (statusFilter) {
        window.sessionStorage.setItem(historyStatusFilterStorageKey, statusFilter);
      } else {
        window.sessionStorage.removeItem(historyStatusFilterStorageKey);
      }
    }

    onNavigate("web-history");
  };

  const handleOpenHistoryThisMonth = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(selectedHistoryScanStorageKey);
      window.sessionStorage.removeItem(historyStatusFilterStorageKey);
      window.sessionStorage.setItem(historyDateFilterStorageKey, "this-month");
    }

    onNavigate("web-history");
  };

  const handleOpenAllHistory = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(selectedHistoryScanStorageKey);
      window.sessionStorage.removeItem(historyStatusFilterStorageKey);
      window.sessionStorage.removeItem(historyDateFilterStorageKey);
    }

    onNavigate("web-history");
  };

  return (
    <AppShell
      homePage="web-dashboard"
      onNavigate={onNavigate}
      brandSubtitle="Plant Inspector"
      footerCard={<SessionCard name={displayName} email={displayEmail} />}
      onLogout={() => {
        clearAuthToken();
        onNavigate("web-login");
      }}
      logoutIcon={<LogOut className="w-4 h-4" />}
      navItems={navItems}
      sidebarClassName="w-72 bg-white/60 backdrop-blur-md border-r-2 border-[#0d4d3d]/10 p-6 shadow-xl"
      contentClassName="flex-1 overflow-auto overflow-x-hidden p-8 lg:pl-2"
    >
          <div className="mb-8">
            <div>
              <h2 className="text-3xl text-[#0d4d3d] mb-2">Dashboard</h2>
              <div className="flex items-center gap-2 text-[#2a2d35]/60">
                <MapPin className="w-4 h-4" />
                <span>
                  {isLoading
                    ? "Loading scan coverage..."
                    : `${dashboardStats.locationCount} saved location${dashboardStats.locationCount === 1 ? "" : "s"} across your scan history`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:gap-6 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <VCard
                  variant="organic"
                  hover={stat.label === "Healthy Plants" || stat.label === "Diseases Found"}
                  onClick={
                    stat.label === "Total Scans"
                      ? handleOpenAllHistory
                      : stat.label === "Healthy Plants"
                      ? () => handleOpenHistoryWithFilter("healthy")
                      : stat.label === "Diseases Found"
                        ? () => handleOpenHistoryWithFilter("diseased")
                        : stat.label === "This Month"
                          ? handleOpenHistoryThisMonth
                        : undefined
                  }
                  className={stat.label === "Total Scans" || stat.label === "Healthy Plants" || stat.label === "Diseases Found" || stat.label === "This Month" ? "cursor-pointer" : ""}
                >
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
              <p className="text-red-700">{error instanceof Error ? error.message : "Failed to load dashboard data."}</p>
            </VCard>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-[#0d4d3d]">Recent Scans</h3>
              <button onClick={() => onNavigate("web-history")} className="text-[#0d4d3d] hover:text-[#9ae66e] transition-colors">
                View all
              </button>
            </div>

            {isLoading ? (
              <div className="grid gap-4 lg:gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {[0, 1, 2].map((item) => (
                  <VCard key={item} variant="glass" className="min-h-[16rem] flex items-center justify-center">
                    <p className="text-[#2a2d35]/60">Loading scans...</p>
                  </VCard>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {recentScans.map((scan) => (
                  <div key={scan.id}>
                    <PlantCard {...scan} onClick={() => handleOpenRecentScan(scan.id)} />
                  </div>
                ))}

                {!error && recentScans.length === 0 && (
                  <VCard variant="glass" className="min-h-[16rem] flex items-center justify-center">
                    <div className="text-center px-6">
                      <p className="text-lg text-[#0d4d3d] mb-2">No scans yet</p>
                      <p className="text-sm text-[#2a2d35]/60">Start with your first plant scan to populate the dashboard.</p>
                    </div>
                  </VCard>
                )}

                <VCard variant="glass" hover onClick={() => onNavigate("web-scan")} className="!p-0 overflow-hidden border-2 border-dashed border-[#0d4d3d]/30 cursor-pointer">
                  <div className="h-40 bg-gradient-to-br from-[#0d4d3d]/8 to-[#9ae66e]/10 flex items-center justify-center">
                    <Scan className="w-12 h-12 text-[#0d4d3d]/40" />
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-lg text-[#0d4d3d] mb-1">Scan new plant</p>
                    <p className="text-sm text-[#2a2d35]/60">Add a fresh sample</p>
                  </div>
                </VCard>
              </div>
            )}
          </div>
          <div className="h-3" />
    </AppShell>
  );
}
