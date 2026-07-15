import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scan, History, User, LogOut, Calendar, MapPin, BarChart3, Leaf, Bell } from "lucide-react";
import { VCard } from "../../visionqc/VCard";
import { VInput } from "../../visionqc/VInput";
import { SeverityBadge } from "../../visionqc/SeverityBadge";
import { MoreInfoChat } from "../../visionqc/MoreInfoChat";
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

function toSentenceBullets(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getAnalysisFallback(disease) {
  const name = typeof disease === "string" ? disease.trim() : "";
  if (!name || name.toLowerCase() === "unknown") {
    return "The scan finished, but no detailed explanation was returned.";
  }

  if (/healthy/i.test(name)) {
    return "This plant appears healthy based on the scan result.";
  }

  return `This scan result is ${name}.`;
}

function shouldShowPhotoAdvice(photoQuality) {
  return Boolean(
    photoQuality &&
      photoQuality.canDiagnose === false &&
      typeof photoQuality.qualityScore === "number" &&
      photoQuality.qualityScore <= 59
  );
}

export function WebHistory({ onNavigate }) {
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Vision QC User";
  const displayEmail = authUser?.email || "No email available";
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [error, setError] = useState("");
  const deferredSearchFilter = useDeferredValue(searchFilter);

  const {
    data: historyItems = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => fetchScanHistory(),
  });

  useEffect(() => {
    setError(queryError instanceof Error ? queryError.message : "");
    if (typeof window === "undefined" || historyItems.length === 0) {
      return;
    }

    const preselectedScanId = window.sessionStorage.getItem(selectedHistoryScanStorageKey);
    const preselectedStatusFilter = window.sessionStorage.getItem(historyStatusFilterStorageKey);
    const preselectedDateFilter = window.sessionStorage.getItem(historyDateFilterStorageKey);

    if (preselectedScanId) {
      const matchingScan = historyItems.find((item) => String(item.id) === preselectedScanId);

      if (matchingScan) {
        setSelectedScanId(matchingScan.id);
      }

      window.sessionStorage.removeItem(selectedHistoryScanStorageKey);
    }

    if (preselectedStatusFilter === "healthy" || preselectedStatusFilter === "diseased") {
      setStatusFilter(preselectedStatusFilter);
      setSelectedScanId(null);
    }

    if (preselectedDateFilter === "this-month") {
      setDateFilter("this-month");
      setSelectedScanId(null);
    }

    window.sessionStorage.removeItem(historyStatusFilterStorageKey);
    window.sessionStorage.removeItem(historyDateFilterStorageKey);
  }, [historyItems, queryError]);

  const filteredItems = useMemo(() => {
    const query = deferredSearchFilter.trim().toLowerCase();
    const now = new Date();

    return historyItems.filter((item) => {
      const matchesSearch =
        !query ||
        [item.alias, item.location]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "healthy" ? isHealthyScan(item) : !isHealthyScan(item));

      const scannedDate = new Date(item.scannedAt);
      const matchesDate =
        dateFilter === "all" ||
        (!Number.isNaN(scannedDate.getTime()) &&
          scannedDate.getMonth() === now.getMonth() &&
          scannedDate.getFullYear() === now.getFullYear());

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateFilter, deferredSearchFilter, historyItems, statusFilter]);

  const navItems = useMemo(() => ([
    { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
    { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" /> },
    { page: "web-history", label: "History", icon: <History className="w-5 h-5" />, isActive: true },
    { page: "web-reminders", label: "Reminders", icon: <Bell className="w-5 h-5" /> },
    { page: "web-plant-aliases", label: "Plant Aliases", icon: <Leaf className="w-5 h-5" /> },
    { page: "web-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" /> },
  ]), []);

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
    >
          <h2 className="text-3xl text-[#0d4d3d] mb-6">History</h2>
          <div className="mb-4 max-w-4xl">
            <p className="mb-2 text-[#2a2d35] opacity-80">Filter by alias or location</p>
            <VInput
              placeholder="Type alias or location"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              icon={<MapPin className="w-5 h-5" />}
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-3">
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
              onClick={() => setStatusFilter("healthy")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "healthy"
                  ? "bg-[#0a6b52] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              Healthy
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("diseased")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                statusFilter === "diseased"
                  ? "bg-[#b42318] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              Diseased
            </button>
          </div>
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                dateFilter === "all"
                  ? "bg-[#0d4d3d] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("this-month")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                dateFilter === "this-month"
                  ? "bg-[#0a6b52] text-white"
                  : "bg-white/75 text-[#0d4d3d] border border-[#0d4d3d]/10"
              }`}
            >
              This Month
            </button>
          </div>
          <div className="space-y-4">
            {isLoading && (
              <VCard variant="glass">
                <p className="text-[#2a2d35]/70">Loading scan history...</p>
              </VCard>
            )}
            {!isLoading && error && (
              <VCard variant="glass">
                <p className="text-red-700">{error}</p>
              </VCard>
            )}
            {!isLoading && !error && filteredItems.map((item) => (
              <VCard
                key={item.id}
                variant="organic"
                hover
              >
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScanId((currentId) => (currentId === item.id ? null : item.id));
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg text-[#0d4d3d]">{item.alias}</p>
                        <p className="text-sm text-[#2a2d35]/70">{item.disease}</p>
                      </div>
                      <div className="text-sm text-[#2a2d35]/60 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(item.scannedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{item.location || "No location"}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                    {selectedScanId === item.id && (
                      <div className="overflow-hidden">
                        <div className="rounded-3xl border border-[#0d4d3d]/10 bg-white/65 px-5 pt-5 pb-8 shadow-sm">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.alias}
                              className="w-full h-64 object-cover rounded-2xl mb-4"
                            />
                          ) : (
                            <div className="w-full h-64 rounded-2xl mb-4 bg-[#fafaf8] border border-[#0d4d3d]/10 flex items-center justify-center text-[#2a2d35]/50">
                              No image available
                            </div>
                          )}
                          <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3">
                            <p className="text-sm text-[#2a2d35]/60 mb-1">Confidence</p>
                            <p className="text-[#0d4d3d]">
                              {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : "N/A"}
                            </p>
                          </div>
                          {item.severityLevel && (
                            <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3 mt-4">
                              <p className="text-sm text-[#2a2d35]/60 mb-1">Severity</p>
                              <SeverityBadge level={item.severityLevel} />
                            </div>
                          )}
                          {shouldShowPhotoAdvice(item.photoQuality) &&
                            toSentenceBullets(item.photoQuality?.retakeAdvice || "").length > 0 && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 mt-4">
                              <p className="text-sm text-amber-900/70 mb-2">Photo Advice</p>
                              <ul className="list-disc pl-5 text-amber-900 space-y-1">
                                {toSentenceBullets(item.photoQuality?.retakeAdvice || "").map((advice, index) => (
                                  <li key={`${item.id}-photo-advice-${index}`}>{advice}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3 mt-4">
                            <p className="text-sm text-[#2a2d35]/60 mb-1">Analysis</p>
                            <p className="text-[#0d4d3d]">
                              {item.analysis || getAnalysisFallback(item.disease)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3 mt-4">
                            <p className="text-sm text-[#2a2d35]/60 mb-1">Recommended Action</p>
                            <p className="text-[#0d4d3d]">{item.solution || "No recommendation available."}</p>
                          </div>
                          {item.recommendedProducts?.length > 0 && (
                            <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3 mt-4">
                              <p className="text-sm text-[#2a2d35]/60 mb-2">Recommended Products</p>
                              <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
                                {item.recommendedProducts.map((product, index) => (
                                  <li key={`${item.id}-product-${index}`}>{product}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.prevention && (
                            <div className="rounded-2xl bg-[#fafaf8]/80 px-4 py-3 mt-4">
                              <p className="text-sm text-[#2a2d35]/60 mb-1">Prevention</p>
                              <p className="text-[#0d4d3d]">{item.prevention}</p>
                            </div>
                          )}
                          <div className="mt-4">
                            <MoreInfoChat scan={item} />
                          </div>
                          {item.rescanRecommended && !isHealthyScan(item) && (
                            <div className="rounded-2xl bg-[#f5faf7] px-4 py-3 mt-4 border border-[#0d4d3d]/10">
                              <p className="text-sm text-[#2a2d35]/60 mb-1">Follow-up Reminder</p>
                              <p className="text-[#0d4d3d]">
                                Re-scan this plant in <strong>{item.rescanDays} days</strong>.
                              </p>
                              {item.rescanReason && (
                                <p className="text-sm text-[#2a2d35]/70 mt-1">{item.rescanReason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </VCard>
            ))}
            {!isLoading && !error && filteredItems.length === 0 && (
              <VCard variant="glass">
                <p className="text-[#2a2d35]/70">
                  {historyItems.length === 0 ? "No scans saved yet." : "No results found for the selected filters."}
                </p>
              </VCard>
            )}
          </div>
    </AppShell>
  );
}
