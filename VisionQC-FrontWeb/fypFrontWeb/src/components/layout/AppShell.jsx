import { BlobBackground } from "../visionqc/BlobBackground";
import { BrandLogo } from "../visionqc/BrandLogo";
import { VCard } from "../visionqc/VCard";
import { VButton } from "../visionqc/VButton";

export function AppShell({
  homePage,
  onNavigate,
  brandSubtitle,
  navItems,
  footerCard,
  onLogout,
  logoutIcon,
  logoutLabel = "Logout",
  children,
  contentClassName = "flex-1 overflow-auto p-8 lg:pl-2",
  sidebarClassName = "w-72 bg-white/60 backdrop-blur-md border-r-2 border-[#0d4d3d]/10 p-6",
  layoutClassName = "relative z-10 flex h-screen gap-4 lg:gap-6 pr-4 lg:pr-6",
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fafaf8] via-[#e8e3d8] to-[#fafaf8] relative overflow-hidden">
      <BlobBackground />

      <div className={layoutClassName}>
        <aside className={sidebarClassName}>
          <button onClick={() => onNavigate(homePage)} className="w-full flex items-center gap-3 mb-12 text-left cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center">
              <BrandLogo className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h1 className="text-xl text-[#0d4d3d]">Vision QC</h1>
              <p className="text-xs text-[#2a2d35]/60">{brandSubtitle}</p>
            </div>
          </button>

          <nav className="space-y-2 mb-12">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
                  item.isActive
                    ? "bg-gradient-to-r from-[#0d4d3d] to-[#0a6b52] text-white"
                    : "hover:bg-[#0d4d3d]/5 text-[#2a2d35]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            {footerCard}
            <VButton variant="ghost" size="sm" className="w-full" onClick={onLogout}>
              <div className="flex items-center justify-center gap-2">
                {logoutIcon}
                <span>{logoutLabel}</span>
              </div>
            </VButton>
          </div>
        </aside>

        <main className={contentClassName}>{children}</main>
      </div>
    </div>
  );
}
