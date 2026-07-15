import { VCard } from "../visionqc/VCard";

export function SessionCard({ title = "Logged in as", name, email, role }) {
  return (
    <VCard variant="glass" className="!p-4 mb-3">
      {role ? (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#2a2d35]/70">{title}</p>
          <span className="px-2 py-0.5 rounded-full bg-[#9ae66e] text-[#0d4d3d] text-xs">{role}</span>
        </div>
      ) : (
        <p className="text-xs text-[#2a2d35]/70 mb-2">{title}</p>
      )}
      <p className="text-sm text-[#0d4d3d]">{name}</p>
      <p className="text-xs text-[#2a2d35]/60">{email}</p>
    </VCard>
  );
}
