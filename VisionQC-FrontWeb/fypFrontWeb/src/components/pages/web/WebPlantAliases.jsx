import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, Check, History, Leaf, LogOut, MapPin, Pencil, Plus, Scan, Search, Trash2, User, X } from "lucide-react";
import { AppShell } from "../../layout/AppShell";
import { SessionCard } from "../../layout/SessionCard";
import { VCard } from "../../visionqc/VCard";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { clearAuthToken, getAuthUser } from "../../../lib/auth";
import { createPlantAlias, deletePlantAlias, fetchPlantAliases, updatePlantAlias } from "../../../lib/plants";

function formatDate(value) {
  if (!value) return "Not available";

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

export function WebPlantAliases({ onNavigate }) {
  const [aliases, setAliases] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [newAliasLocation, setNewAliasLocation] = useState("");
  const [addAliasError, setAddAliasError] = useState("");
  const [deleteAliasError, setDeleteAliasError] = useState("");
  const [isSubmittingAlias, setIsSubmittingAlias] = useState(false);
  const [deletingAliasId, setDeletingAliasId] = useState("");

  const locationSuggestions = useMemo(
    () =>
      [...new Set(
        aliases
          .map((alias) => (alias.location || "").trim())
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right)),
    [aliases]
  );
  const [editingAliasId, setEditingAliasId] = useState("");
  const [editAliasName, setEditAliasName] = useState("");
  const [editAliasLocation, setEditAliasLocation] = useState("");
  const [editAliasError, setEditAliasError] = useState("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const authUser = useMemo(() => getAuthUser(), []);
  const displayName = authUser?.fullName || "Vision QC User";
  const displayEmail = authUser?.email || "No email available";
  const navItems = useMemo(
    () => [
      { page: "web-dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" />, isActive: false },
      { page: "web-scan", label: "Scan Plant", icon: <Scan className="w-5 h-5" />, isActive: false },
      { page: "web-history", label: "History", icon: <History className="w-5 h-5" />, isActive: false },
      { page: "web-reminders", label: "Reminders", icon: <Bell className="w-5 h-5" />, isActive: false },
      { page: "web-plant-aliases", label: "Plant Aliases", icon: <Leaf className="w-5 h-5" />, isActive: true },
      { page: "web-edit-profile", label: "Edit Info", icon: <User className="w-5 h-5" />, isActive: false },
    ],
    []
  );

  useEffect(() => {
    let isCancelled = false;

    const loadAliases = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await fetchPlantAliases();

        if (!isCancelled) {
          setAliases(data);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to load plant aliases.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAliases();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredAliases = aliases.filter((alias) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [
      alias.alias,
      alias.location,
      ...(Array.isArray(alias.locations) ? alias.locations : []),
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
    const aliasLocations = [
      alias.location,
      ...(Array.isArray(alias.locations) ? alias.locations : []),
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return matchesSearch && (!query || aliasLocations.length >= 0);
  });

  const handleAddAlias = async () => {
    try {
      setIsSubmittingAlias(true);
      setAddAliasError("");
      setDeleteAliasError("");

      const createdAlias = await createPlantAlias({
        alias: newAlias,
        location: newAliasLocation,
      });

      setAliases((currentAliases) =>
        [...currentAliases, createdAlias].sort((left, right) => left.alias.localeCompare(right.alias))
      );
      setSearchQuery("");
      setNewAlias("");
      setNewAliasLocation("");
      setIsAddingAlias(false);
    } catch (err) {
      setAddAliasError(err instanceof Error ? err.message : "Failed to create plant alias.");
    } finally {
      setIsSubmittingAlias(false);
    }
  };

  const handleDeleteAlias = async (aliasToDelete) => {
    const confirmed = window.confirm(`Delete alias "${aliasToDelete.alias}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingAliasId(aliasToDelete.id);
      setDeleteAliasError("");
      setAddAliasError("");

      await deletePlantAlias(aliasToDelete.id);
      setAliases((currentAliases) =>
        currentAliases.filter((currentAlias) => currentAlias.id !== aliasToDelete.id)
      );
    } catch (err) {
      setDeleteAliasError(err instanceof Error ? err.message : "Failed to delete plant alias.");
    } finally {
      setDeletingAliasId("");
    }
  };

  const startEditingAlias = (aliasToEdit) => {
    setEditingAliasId(aliasToEdit.id);
    setEditAliasName(aliasToEdit.alias || "");
    setEditAliasLocation(aliasToEdit.location || "");
    setEditAliasError("");
    setAddAliasError("");
    setDeleteAliasError("");
  };

  const cancelEditingAlias = () => {
    setEditingAliasId("");
    setEditAliasName("");
    setEditAliasLocation("");
    setEditAliasError("");
  };

  const handleSaveAlias = async () => {
    if (!editingAliasId) {
      return;
    }

    try {
      setIsSavingAlias(true);
      setEditAliasError("");
      setAddAliasError("");
      setDeleteAliasError("");

      const updatedAlias = await updatePlantAlias({
        id: editingAliasId,
        alias: editAliasName,
        location: editAliasLocation,
      });

      setAliases((currentAliases) =>
        currentAliases
          .map((currentAlias) =>
            currentAlias.id === editingAliasId ? updatedAlias : currentAlias
          )
          .sort((left, right) => left.alias.localeCompare(right.alias))
      );
      cancelEditingAlias();
    } catch (err) {
      setEditAliasError(err instanceof Error ? err.message : "Failed to update plant alias.");
    } finally {
      setIsSavingAlias(false);
    }
  };

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
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl text-[#0d4d3d] mb-1">Plant Aliases</h2>
                <p className="text-[#2a2d35]/60">Browse all aliases and their saved locations in one simple table.</p>
              </div>
              <VButton
                data-testid="plant-alias-toggle"
                aria-expanded={isAddingAlias}
                variant="accent"
                size="sm"
                onClick={() => {
                  setIsAddingAlias((current) => !current);
                  setAddAliasError("");
                }}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>{isAddingAlias ? "Cancel" : "Add Plant Alias"}</span>
                </div>
              </VButton>
            </div>
          </div>

          {isAddingAlias && (
              <div
                data-testid="plant-alias-form"
                data-state="open"
                className="mb-6"
              >
                <VCard variant="organic">
                  <div className="grid gap-4 md:grid-cols-2">
                    <VInput
                      data-testid="plant-alias-name-input"
                      label="Alias Name"
                      placeholder="e.g. Tomato Plant #3"
                      value={newAlias}
                      onChange={(event) => {
                        setNewAlias(event.target.value);
                        setAddAliasError("");
                      }}
                      icon={<Leaf className="w-5 h-5" />}
                    />
                    <VInput
                      data-testid="plant-alias-location-input"
                      label="Location"
                      placeholder="e.g. Garden A"
                      value={newAliasLocation}
                      onChange={(event) => {
                        setNewAliasLocation(event.target.value);
                        setAddAliasError("");
                      }}
                      icon={<MapPin className="w-5 h-5" />}
                      list="plant-alias-location-suggestions"
                    />
                    <datalist id="plant-alias-location-suggestions">
                      {locationSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>
                  {addAliasError && (
                    <p className="mt-4 text-sm text-red-700">{addAliasError}</p>
                  )}
                  <div className="mt-4 flex justify-end">
                    <VButton
                      data-testid="plant-alias-save-button"
                      variant="primary"
                      size="sm"
                      onClick={handleAddAlias}
                      disabled={isSubmittingAlias}
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        <span>{isSubmittingAlias ? "Adding..." : "Save Alias"}</span>
                      </div>
                    </VButton>
                  </div>
                </VCard>
              </div>
            )}

          <VCard variant="glass" className="mb-6">
            <VInput
              label="Search aliases or locations"
              placeholder="Search by alias or location"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              icon={<Search className="w-5 h-5" />}
            />
            {deleteAliasError && (
              <p className="mt-4 text-sm text-red-700">{deleteAliasError}</p>
            )}
            {editAliasError && (
              <p className="mt-4 text-sm text-red-700">{editAliasError}</p>
            )}
          </VCard>

          <div>
            <VCard variant="organic">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alias</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Scans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-[#2a2d35]/60">
                        Loading plant aliases...
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && error && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-red-700">
                        {error}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    !error &&
                    filteredAliases.map((alias, index) => (
                      <TableRow key={alias.id} className="align-top">
                          <TableCell className="font-medium text-[#0d4d3d]">
                            <div>
                              <div className="flex items-center gap-3">
                                {editingAliasId === alias.id ? (
                                  <VInput
                                    value={editAliasName}
                                    onChange={(event) => {
                                      setEditAliasName(event.target.value);
                                      setEditAliasError("");
                                    }}
                                    placeholder="Alias name"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onDoubleClick={() => startEditingAlias(alias)}
                                    className="text-left cursor-text"
                                    title="Double-click to edit alias"
                                  >
                                    <div>{alias.alias}</div>
                                  </button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingAliasId === alias.id ? (
                              <VInput
                                value={editAliasLocation}
                                onChange={(event) => {
                                  setEditAliasLocation(event.target.value);
                                  setEditAliasError("");
                                }}
                                placeholder="Location"
                                list="plant-alias-location-suggestions"
                              />
                            ) : (
                              <button
                                type="button"
                                onDoubleClick={() => startEditingAlias(alias)}
                                className="text-left cursor-text"
                                title="Double-click to edit location"
                              >
                                {alias.location || "No location"}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(alias.createdAt)}</TableCell>
                          <TableCell>{formatDate(alias.updatedAt)}</TableCell>
                          <TableCell className="text-right">{alias.scanCount}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              {editingAliasId === alias.id ? (
                                <div className="flex items-center gap-2">
                                  <VButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={cancelEditingAlias}
                                    disabled={isSavingAlias}
                                  >
                                    <div className="flex items-center gap-2">
                                      <X className="w-4 h-4" />
                                      <span>Cancel</span>
                                    </div>
                                  </VButton>
                                  <VButton
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSaveAlias}
                                    disabled={isSavingAlias}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Check className="w-4 h-4" />
                                      <span>{isSavingAlias ? "Saving..." : "Save"}</span>
                                    </div>
                                  </VButton>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => startEditingAlias(alias)}
                                    className="inline-flex items-center justify-center text-[#0d4d3d] transition-colors hover:text-[#0a6b52]"
                                    aria-label="Edit alias"
                                    title="Edit alias"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center text-red-700 transition-colors hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => handleDeleteAlias(alias)}
                                    disabled={deletingAliasId === alias.id}
                                    aria-label="Delete alias"
                                    title="Delete alias"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                    ))}

                  {!isLoading && !error && filteredAliases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-[#2a2d35]/60">
                        No plant aliases matched your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </VCard>
          </div>
    </AppShell>
  );
}
