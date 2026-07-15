import { useEffect, useMemo, useRef, useState } from "react";
import { Scan, History, User, LogOut, Camera, BarChart3, CheckCircle2, MapPin, Leaf, AlertCircle, Plus, Sparkles, Bell, Check } from "lucide-react";
import { VCard } from "../../visionqc/VCard";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { SeverityBadge } from "../../visionqc/SeverityBadge";
import { MoreInfoChat } from "../../visionqc/MoreInfoChat";
import { createPlantAlias, fetchPlantAliases } from "../../../lib/plants";
import { enablePushReminder } from "../../../lib/reminders";
import { createScan } from "../../../lib/scans";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";
import { clearAuthToken, getAuthUser } from "../../../lib/auth";

const OTHER_ALIAS_VALUE = "__other__";

function getCaptureMode() {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ? "environment" : undefined;
}

function getDefaultScanQuality() {
  return {
    blur: {
      label: "Blur",
      isGood: true,
      title: "Image looks sharp enough",
      description: "The leaf details look clear enough for a first scan.",
    },
    lighting: {
      label: "Lighting",
      isGood: true,
      title: "Lighting looks good",
      description: "The image has enough light for a better analysis.",
    },
    distance: {
      label: "Distance",
      isGood: true,
      title: "Plant is close enough",
      description: "The plant seems large enough in the photo to analyze.",
    },
  };
}

async function analyzeScanQuality(imageUrl) {
  const { analyzeScanQuality: analyzeSelectedImage } = await import("../../../lib/scanQuality");
  return analyzeSelectedImage(imageUrl);
}

function scheduleDeferredWork(callback) {
  if (typeof window === "undefined") {
    return callback();
  }

  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 400 });
    return () => window.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 120);
  return () => window.clearTimeout(handle);
}


function toBackendScanQuality(photoQuality) {
  if (!photoQuality || typeof photoQuality !== "object") {
    return null;
  }

  const issues = Array.isArray(photoQuality.issues) ? photoQuality.issues : [];
  const metrics = photoQuality.metrics && typeof photoQuality.metrics === "object" ? photoQuality.metrics : {};
  const blurValue =
    typeof metrics.blur === "number" && Number.isFinite(metrics.blur) ? metrics.blur : null;
  const brightnessValue =
    typeof metrics.brightness === "number" && Number.isFinite(metrics.brightness)
      ? metrics.brightness
      : null;
  const widthValue =
    typeof metrics.width === "number" && Number.isFinite(metrics.width) ? metrics.width : null;
  const heightValue =
    typeof metrics.height === "number" && Number.isFinite(metrics.height) ? metrics.height : null;

  return {
    blur: issues.includes("Image is blurry.")
      ? {
          label: "Blur",
          isGood: false,
          title: "Photo looks blurry",
          description: "Take a steadier and sharper photo for better results.",
        }
      : {
          label: "Blur",
          isGood: true,
          title: blurValue !== null ? `Sharpness looks usable (${Math.round(blurValue)})` : "Sharpness looks usable",
          description: "The backend accepted the image detail for diagnosis.",
        },
    lighting:
      issues.includes("Image is too dark.") || issues.includes("Image is too bright.")
        ? {
            label: "Lighting",
            isGood: false,
            title: issues.includes("Image is too dark.")
              ? "Photo is too dark"
              : "Photo is too bright",
            description: "Use more balanced lighting for better results.",
          }
        : {
            label: "Lighting",
            isGood: true,
            title:
              brightnessValue !== null
                ? `Lighting looks usable (${Math.round(brightnessValue)})`
                : "Lighting looks usable",
            description: "The backend did not flag a major lighting issue.",
          },
    distance:
      issues.includes("Image resolution is too low.")
        ? {
            label: "Distance",
            isGood: false,
            title: "Photo resolution is too low",
            description: "Move closer and make the plant fill more of the frame for better results.",
          }
        : {
            label: "Distance",
            isGood: true,
            title:
              widthValue !== null && heightValue !== null
                ? `Resolution looks usable (${widthValue}x${heightValue})`
                : "Resolution looks usable",
            description: "The backend accepted the image size for diagnosis.",
          },
  };
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

function isHealthyDiagnosis(disease) {
  const value = (disease || "").trim().toLowerCase();

  if (!value || value.includes("no plant")) {
    return false;
  }

  return (
    value === "healthy" ||
    value === "healthy plant" ||
    value === "no disease" ||
    value === "none" ||
    value.includes("healthy") ||
    value.includes("no disease detected") ||
    value.includes("no obvious disease detected")
  );
}

function shouldShowPhotoAdvice(photoQuality) {
  return Boolean(
    photoQuality &&
      photoQuality.canDiagnose === false &&
      typeof photoQuality.qualityScore === "number" &&
      photoQuality.qualityScore <= 59
  );
}

function getScanSubmitErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.replace(/^AI diagnosis failed:\s*/i, "").trim();

  if (
    /not a valid plant image|only image files allowed|invalid image|empty image file|clear plant leaf image|plant image/i.test(
      normalizedMessage
    )
  ) {
    return "This is not a valid image. Please upload a valid plant picture in PNG, JPG, or JPEG format.";
  }

  return normalizedMessage || "Unable to analyze the image.";
}

export function WebScan({ onNavigate }) {
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Vision QC User";
  const displayEmail = authUser?.email || "No email available";
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [plantAlias, setPlantAlias] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [location, setLocation] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [plantAliases, setPlantAliases] = useState([]);
  const [isLoadingAliases, setIsLoadingAliases] = useState(true);
  const [aliasError, setAliasError] = useState("");
  const [isCreatingAlias, setIsCreatingAlias] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [scanQuality, setScanQuality] = useState(getDefaultScanQuality());
  const [reminderNotice, setReminderNotice] = useState("");
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [enabledReminderScanIds, setEnabledReminderScanIds] = useState(() => new Set());
  const fileInputRef = useRef(null);
  const locationSuggestions = useMemo(
    () =>
      [...new Set(
        plantAliases
          .map((alias) => (alias.location || "").trim())
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right)),
    [plantAliases]
  );

  useEffect(() => {
    let isCancelled = false;

    const loadPlantAliases = async () => {
      try {
        setAliasError("");
        setIsLoadingAliases(true);
        const data = await fetchPlantAliases();
        if (!isCancelled) {
          setPlantAliases(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setPlantAliases([]);
          setAliasError(error instanceof Error ? error.message : "Failed to load plant aliases.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAliases(false);
        }
      }
    };

    loadPlantAliases();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
      }
    };
  }, [selectedImage]);

  useEffect(() => {
    let isCancelled = false;
    let cancelScheduledWork = null;

    const updateScanQuality = async () => {
      if (!selectedImage) {
        setScanQuality(getDefaultScanQuality());
        return;
      }

      cancelScheduledWork = scheduleDeferredWork(async () => {
        try {
          const nextQuality = await analyzeScanQuality(selectedImage);
          if (!isCancelled) {
            setScanQuality(nextQuality || getDefaultScanQuality());
          }
        } catch {
          if (!isCancelled) {
            setScanQuality(getDefaultScanQuality());
          }
        }
      });
    };

    updateScanQuality();

    return () => {
      isCancelled = true;
      cancelScheduledWork?.();
    };
  }, [selectedImage]);

  const handlePickImage = () => {
    if (isSubmitting) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      setSelectedFile(null);
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
        setSelectedImage("");
      }
      setAnalysisResult(null);
      setSubmitNotice("");
      setSubmitError("Please upload an image file, not a PDF or document.");
      return;
    }

    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setSelectedImage(objectUrl);
    setAnalysisResult(null);
    setReminderNotice("");
    setSubmitError("");
    setSubmitNotice("");
  };

  const selectedAliasValue = plantAlias === OTHER_ALIAS_VALUE ? customAlias : plantAlias;
  const selectedAliasRecord = useMemo(
    () => plantAliases.find((alias) => alias.alias === plantAlias),
    [plantAliases, plantAlias]
  );
  const backendScanQuality = useMemo(
    () => toBackendScanQuality(analysisResult?.photoQuality),
    [analysisResult?.photoQuality]
  );
  const displayedScanQuality = backendScanQuality || scanQuality;
  const displayedScanQualityItems = useMemo(
    () => Object.values(displayedScanQuality),
    [displayedScanQuality]
  );
  const displayedNeedsQualityImprovement = useMemo(
    () => displayedScanQualityItems.some((item) => !item.isGood),
    [displayedScanQualityItems]
  );
  const selectedFileIsImage = Boolean(selectedFile?.type?.startsWith("image/"));
  const canSubmitScan = !isSubmitting && selectedFileIsImage;

  const handleCreateAlias = async () => {
    try {
      setIsCreatingAlias(true);
      setAliasError("");
      setSubmitError("");
      setSubmitNotice("");

      const createdAlias = await createPlantAlias({
        alias: customAlias,
        location,
      });

      setPlantAliases((currentAliases) =>
        [...currentAliases, createdAlias]
          .filter(
            (alias, index, aliases) =>
              aliases.findIndex((entry) => entry.alias.toLowerCase() === alias.alias.toLowerCase()) === index
          )
          .sort((left, right) => left.alias.localeCompare(right.alias))
      );
      setPlantAlias(createdAlias.alias);
      setCustomAlias("");
      setLocation(createdAlias.location || location);
      setSubmitNotice(`Alias "${createdAlias.alias}" added. Select it from the dropdown.`);
    } catch (error) {
      setAliasError(error instanceof Error ? error.message : "Failed to add the new alias.");
    } finally {
      setIsCreatingAlias(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitNotice("");
      setReminderNotice("");
      const fallbackFile =
        fileInputRef.current instanceof HTMLInputElement
          ? fileInputRef.current.files?.[0] || null
          : null;
      const imageFile = selectedFile || fallbackFile;

      const result = await createScan({
        imageFile,
        alias: selectedAliasValue,
        location,
      });

      setAnalysisResult(result);
      setSubmitNotice("Saved to history.");
    } catch (error) {
      setSubmitError(getScanSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetReminder = async () => {
    if (!analysisResult?.rescanRecommended) {
      return;
    }

    try {
      setIsSavingReminder(true);
      setReminderNotice("");
      const response = await enablePushReminder(analysisResult.id);
      setEnabledReminderScanIds((currentIds) => new Set([...currentIds, analysisResult.id]));

      const dueDateText = response?.dueAt
        ? new Date(response.dueAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : null;

      setReminderNotice(
        response?.pushReady
          ? dueDateText
            ? `Reminder saved. Browser push is ready, and we'll notify you around ${dueDateText}.`
            : "Reminder saved. Browser push is ready, and we'll notify you when the follow-up scan is due."
          : dueDateText
            ? `Reminder saved for ${dueDateText}, but browser push is not ready yet. ${response?.pushError || ""}`.trim()
            : `Reminder saved, but browser push is not ready yet. ${response?.pushError || ""}`.trim()
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to enable the reminder.");
    } finally {
      setIsSavingReminder(false);
    }
  };

  const reminderAlreadySaved = analysisResult?.id ? enabledReminderScanIds.has(analysisResult.id) : false;
  const showPhotoAdvice = shouldShowPhotoAdvice(analysisResult?.photoQuality);
  const photoAdviceBullets = useMemo(
    () => toSentenceBullets(analysisResult?.photoQuality?.retakeAdvice || ""),
    [analysisResult?.photoQuality?.retakeAdvice]
  );
  const analysisText = analysisResult?.analysis || getAnalysisFallback(analysisResult?.disease);
  const analysisBullets = useMemo(() => toSentenceBullets(analysisText), [analysisText]);
  const solutionBullets = useMemo(() => toSentenceBullets(analysisResult?.solution || ""), [analysisResult?.solution]);
  const worryBullets = useMemo(() => toSentenceBullets(analysisResult?.prevention || ""), [analysisResult?.prevention]);
  const shouldShowFollowUpReminder =
    Boolean(analysisResult?.rescanRecommended) && !isHealthyDiagnosis(analysisResult?.disease);
  const navItems = useMemo(() => ([
    { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
    { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" />, isActive: true },
    { page: "web-history", label: "History", icon: <History className="w-5 h-5" /> },
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
          <h2 className="text-3xl text-[#0d4d3d] mb-6">Scan Plant</h2>

          <VCard variant="organic" className="mb-6 max-w-5xl w-full">
            <input
              id="scan-file-input"
              ref={fileInputRef}
              data-testid="scan-file-input"
              type="file"
              accept="image/*"
              capture={getCaptureMode()}
              aria-label="Plant image"
              className="mt-4 block w-full max-w-sm text-sm text-[#2a2d35] file:mr-4 file:rounded-full file:border-0 file:bg-[#0d4d3d] file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-[#0a6b52]"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handlePickImage}
              disabled={isSubmitting}
              style={{ minHeight: "16rem" }}
              className={`w-full border-2 border-dashed border-[#0d4d3d]/30 rounded-3xl px-6 py-8 flex items-center justify-center transition-colors ${
                isSubmitting
                  ? "bg-white/40 cursor-not-allowed opacity-80"
                  : "bg-white/50 hover:bg-white/70 cursor-pointer"
              }`}
            >
              <div className="text-center w-full max-w-4xl">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt="Selected plant"
                    className="max-h-[24rem] w-full rounded-2xl mx-auto mb-4 object-contain"
                  />
                ) : (
                  <Camera className="w-10 h-10 text-[#0d4d3d]/40 mx-auto mb-3" />
                )}
                <p className="text-sm text-[#2a2d35]/70 break-words">
                  {selectedImage
                    ? isSubmitting
                      ? "Image locked while the scan is being analyzed"
                      : "Image selected. Click to change image"
                    : "Upload or capture a plant image"}
                </p>
              </div>
            </button>
            <p className="mt-3 text-sm text-[#2a2d35]/60">
              Choose a file directly or click the image area above to browse again.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-[#2a2d35] opacity-80">Plant Alias</label>
                <div className="relative rounded-3xl overflow-hidden border-2 border-[#0d4d3d]/10 bg-white/80 backdrop-blur-sm">
                  <select
                    value={plantAlias}
                    onChange={(e) => {
                      setPlantAlias(e.target.value);
                      setSubmitError("");
                      setSubmitNotice("");
                      if (e.target.value !== OTHER_ALIAS_VALUE) {
                        setCustomAlias("");
                        const nextAlias = plantAliases.find((alias) => alias.alias === e.target.value);
                        if (nextAlias?.location) {
                          setLocation(nextAlias.location);
                        }
                      }
                    }}
                    className="w-full appearance-none bg-transparent px-5 py-3 pr-12 focus:outline-none text-[#2a2d35] cursor-pointer"
                    disabled={isLoadingAliases}
                  >
                    <option value="">
                      {isLoadingAliases ? "Loading aliases..." : "Choose a plant alias"}
                    </option>
                    {plantAliases.map((alias) => (
                      <option key={alias.id || alias.alias} value={alias.alias}>
                        {alias.alias}
                      </option>
                    ))}
                    <option value={OTHER_ALIAS_VALUE}>Other</option>
                  </select>
                </div>
                {aliasError && (
                  <p className="mt-2 text-sm text-red-700">
                    {aliasError}
                  </p>
                )}
              </div>
              {plantAlias === OTHER_ALIAS_VALUE && (
                <div className="space-y-2">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <VInput
                      label="New Alias"
                      placeholder="Type a new alias for this scan"
                      value={customAlias}
                      onChange={(e) => {
                        setCustomAlias(e.target.value);
                        setAliasError("");
                        setSubmitError("");
                        setSubmitNotice("");
                      }}
                      icon={<Leaf className="w-5 h-5" />}
                    />
                    <VButton
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateAlias}
                      disabled={isCreatingAlias}
                      className="md:mb-[1px]"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        <span>{isCreatingAlias ? "Adding..." : "Add Alias"}</span>
                      </div>
                    </VButton>
                  </div>
                </div>
              )}
              <div className={plantAlias === OTHER_ALIAS_VALUE ? "md:col-span-2" : ""}>
                <VInput
                  label="Location (Optional)"
                  placeholder="e.g. Garden A"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setSubmitError("");
                    setSubmitNotice("");
                  }}
                  icon={<MapPin className="w-5 h-5" />}
                  list="scan-location-suggestions"
                />
                <datalist id="scan-location-suggestions">
                  {locationSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
            {selectedAliasRecord?.location && plantAlias !== OTHER_ALIAS_VALUE && (
                  <p className="mt-2 text-sm text-[#2a2d35]/60">
                    Saved alias location: {selectedAliasRecord.location}
                  </p>
                )}
              </div>
            </div>

            {selectedImage && (
              <div className="scan-quality-assistant mt-8 rounded-[1.75rem] border border-[#0d4d3d]/10 bg-white/65 px-5 pt-5 pb-7">
                <div className="mb-3">
                  <h3 className="text-lg text-[#0d4d3d]">Scan Quality Assistant</h3>
                </div>
                <div className="space-y-3">
                  {displayedScanQualityItems.map((tip) => (
                    <div
                      key={tip.label}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                        tip.isGood
                          ? "border-[#9ae66e]/35 bg-[#f4fbef]"
                          : "border-amber-200 bg-amber-50/90"
                      }`}
                    >
                      {tip.isGood ? (
                        <>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d4d3d] text-white">
                            <Check className="h-4 w-4" />
                          </span>
                          <p className="text-sm font-medium text-[#0d4d3d]">{tip.label}</p>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                            <AlertCircle className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-snug text-amber-950">{tip.title}</p>
                            <p className="text-sm leading-snug text-amber-800/85">{tip.description}</p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysisResult && (
              <div data-testid="scan-analysis-result" className="mt-6 rounded-[1.75rem] border border-[#0d4d3d]/10 bg-white/70 px-5 py-8 space-y-4">
                <div className="flex items-center gap-2 text-[#0d4d3d]">
                  <Sparkles className="w-4 h-4" />
                  <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50">AI Diagnosis</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-[#fafaf8] p-4 border border-[#0d4d3d]/10">
                    <p className="text-sm text-[#2a2d35]/60 mb-1">Disease</p>
                    <p className="text-lg text-[#0d4d3d]">{analysisResult.disease || "Unknown"}</p>
                  </div>
                  <div className="rounded-3xl bg-[#fafaf8] p-4 border border-[#0d4d3d]/10">
                    <p className="text-sm text-[#2a2d35]/60 mb-1">Confidence</p>
                    <p className="text-lg text-[#0d4d3d]">
                      {typeof analysisResult.confidence === "number"
                        ? `${Math.round(analysisResult.confidence * 100)}%`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                {showPhotoAdvice && photoAdviceBullets.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <p className="text-sm uppercase tracking-wide text-amber-900/70 mb-2">Photo Advice</p>
                    <ul className="list-disc pl-5 text-amber-900 space-y-1">
                      {photoAdviceBullets.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">What It Is</p>
                  {analysisBullets.length > 0 ? (
                    <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
                      {analysisBullets.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {analysisResult.severityLevel && (
                  <div>
                    <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">Severity</p>
                    <SeverityBadge level={analysisResult.severityLevel} />
                  </div>
                )}
<div>
  <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">
    What To Do
  </p>
  {solutionBullets.length > 0 ? (
    <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
      {solutionBullets.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="text-[#0d4d3d]">No recommendation returned.</p>
  )}
</div>

{analysisResult.recommendedProducts?.length > 0 && (
  <div>
    <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">
      Recommended Products
    </p>
    <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
      {analysisResult.recommendedProducts.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </div>
)}

{analysisResult.treatmentSellers?.length > 0 && (
  <div>
    <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">
      Nearby Places To Buy Treatment
    </p>
    <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
      {analysisResult.treatmentSellers.map((seller, index) => (
        <li key={`${seller.name}-${seller.area || index}`}>
          {seller.name}
          {seller.area ? ` - ${seller.area}` : ""}
        </li>
      ))}
    </ul>
  </div>
)}

{analysisResult.prevention && (
  <div>
    <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">
      When To Worry
    </p>
    {worryBullets.length > 0 ? (
      <ul className="list-disc pl-5 text-[#0d4d3d] space-y-1">
        {worryBullets.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="text-[#0d4d3d]">{analysisResult.prevention}</p>
    )}
  </div>
)}

<MoreInfoChat
  scan={analysisResult}
  fallback={{
    alias: selectedAliasValue,
    location,
  }}
/>

{shouldShowFollowUpReminder && (
  <div className="rounded-2xl border border-[#0d4d3d]/10 bg-[#f5faf7] p-4">
    <p className="text-sm uppercase tracking-wide text-[#2a2d35]/50 mb-2">
      Follow-up Reminder
    </p>
    <p className="text-[#0d4d3d]">
      Re-scan this plant in <strong>{analysisResult.rescanDays} days</strong>.
    </p>
    <p className="text-sm text-[#2a2d35]/70 mt-1">
      {analysisResult.rescanReason}
    </p>

    <VButton
      variant="secondary"
      size="sm"
      onClick={handleSetReminder}
      disabled={isSavingReminder || reminderAlreadySaved}
      className="mt-3 inline-flex w-auto"
    >
      <span>
        {reminderAlreadySaved
          ? "Reminder Saved"
          : isSavingReminder
            ? "Saving Reminder..."
            : "Set Reminder"}
      </span>
    </VButton>
    {reminderNotice && (
      <p className="mt-3 text-sm text-[#0d4d3d]">
        {reminderNotice}
      </p>
    )}
  </div>
)}

              </div>
            )}

            {submitError && (
              <div className="mt-6 rounded-[1.75rem] border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            {submitNotice && !submitError && (
              <div className="mt-6 rounded-[1.75rem] border border-[#0d4d3d]/10 bg-[#eef8e7] p-4 text-[#0d4d3d] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <p>{submitNotice}</p>
              </div>
            )}

          </VCard>

          <div className="flex gap-4 w-full max-w-5xl">
            <VButton
              variant="accent"
              size="md"
              style={{ marginLeft: "auto" }}
              onClick={handleSubmit}
              disabled={!canSubmitScan}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{isSubmitting ? "Analyzing..." : "Submit"}</span>
              </div>
            </VButton>
          </div>
    </AppShell>
  );
}
