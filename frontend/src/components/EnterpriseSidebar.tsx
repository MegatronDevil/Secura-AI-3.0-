import React from "react";

export type NavTab =
  | "overview"
  | "image-detection"
  | "video-detection"
  | "rgb-rppg"
  | "forensic-evidence"
  | "detection-history"
  | "social-feed"
  | "messages"
  | "communities"
  | "policy-intelligence"
  | "moderation-center"
  | "reports-analytics"
  | "admin-overview"
  | "users-roles"
  | "audit-logs"
  | "system-model-health"
  | "settings-privacy";

interface EnterpriseSidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  clusterLatencyMs?: number | null;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  currentTab,
  onSelectTab,
  clusterLatencyMs = 340,
}) => {
  const [detectMediaOpen, setDetectMediaOpen] = React.useState(true);

  const isActive = (tab: NavTab) => currentTab === tab;

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-[#f8f4ee] border-r border-[#e8e2d8] z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.02)] select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand header */}
        <div
          onClick={() => onSelectTab("overview")}
          className="h-16 px-space-lg flex items-center justify-between border-b border-[#ece5da] bg-[#f8f4ee] shrink-0 cursor-pointer"
        >
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              Secura <span className="text-primary-container font-extrabold">AI</span>
            </span>
            <span className="font-mono-data text-[0.625rem] px-1.5 py-0.5 rounded border border-[#dfd6c8] bg-surface-container-high/60 text-on-surface-variant font-medium tracking-wide">
              ENTERPRISE
            </span>
          </div>
        </div>

        {/* Scrollable menu */}
        <div className="flex-1 overflow-y-auto px-space-md py-space-sm space-y-space-md">
          {/* Core Forensics */}
          <div className="space-y-space-xs">
            <div className="px-space-sm py-1 font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
              Core Forensics
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("overview")}
                className={`w-full flex items-center justify-between px-space-sm py-2 rounded-lg transition-colors font-body-sm text-body-sm text-left ${
                  isActive("overview")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-lg leading-none text-primary-container">
                    dashboard
                  </span>
                  <span>Overview</span>
                </div>
              </button>

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setDetectMediaOpen(!detectMediaOpen)}
                  className="w-full flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-sm text-body-sm text-left"
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-lg leading-none">
                      document_scanner
                    </span>
                    <span>Detect Media</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-sm leading-none text-outline transition-transform ${
                      detectMediaOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {detectMediaOpen && (
                  <div className="pl-8 pr-space-xs space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectTab("image-detection")}
                      className={`w-full block px-space-sm py-1.5 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                        isActive("image-detection")
                          ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      Image Detection
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab("video-detection")}
                      className={`w-full block px-space-sm py-1.5 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                        isActive("video-detection")
                          ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      Video Detection
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab("rgb-rppg")}
                      className={`w-full flex items-center justify-between px-space-sm py-1.5 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                        isActive("rgb-rppg")
                          ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      <span>rPPG Biometrics</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab("forensic-evidence")}
                      className={`w-full block px-space-sm py-1.5 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                        isActive("forensic-evidence")
                          ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      Forensic Evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab("detection-history")}
                      className={`w-full block px-space-sm py-1.5 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                        isActive("detection-history")
                          ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      Detection History
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Social & Community */}
          <div className="space-y-space-xs">
            <div className="px-space-sm py-1 font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
              Social &amp; Community
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("social-feed")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("social-feed")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  dynamic_feed
                </span>
                <span>Social Feed</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("messages")}
                className={`w-full flex items-center justify-between px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("messages")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-lg leading-none">
                    chat
                  </span>
                  <span>Messages</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed font-mono-data text-[0.625rem]">
                  Verified
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("communities")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("communities")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  groups
                </span>
                <span>Communities</span>
              </button>
            </nav>
          </div>

          {/* Intelligence & Safety */}
          <div className="space-y-space-xs">
            <div className="px-space-sm py-1 font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
              Intelligence &amp; Safety
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("policy-intelligence")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("policy-intelligence")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  policy
                </span>
                <span>Policy Intelligence</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("moderation-center")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("moderation-center")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  gavel
                </span>
                <span>Moderation Center</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("reports-analytics")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("reports-analytics")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  analytics
                </span>
                <span>Reports &amp; Analytics</span>
              </button>
            </nav>
          </div>

          {/* Administration */}
          <div className="space-y-space-xs">
            <div className="flex items-center justify-between px-space-sm py-1">
              <span className="font-mono-data text-[0.6875rem] uppercase tracking-wider text-outline font-semibold">
                Administration
              </span>
              <span className="px-1.5 py-0.5 rounded font-mono-data text-[0.625rem] bg-secondary-fixed text-on-secondary-fixed font-semibold">
                ADMIN
              </span>
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab("admin-overview")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("admin-overview")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  admin_panel_settings
                </span>
                <span>Admin Overview</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("users-roles")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("users-roles")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  manage_accounts
                </span>
                <span>Users &amp; Roles</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("audit-logs")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("audit-logs")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  receipt_long
                </span>
                <span>Audit Logs</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("system-model-health")}
                className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
                  isActive("system-model-health")
                    ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(36,35,33,0.04)] font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  monitor_heart
                </span>
                <span>System &amp; Model Health</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer status */}
      <div className="p-space-md border-t border-[#ece5da] bg-[#f8f4ee] shrink-0 space-y-space-sm">
        <nav>
          <button
            type="button"
            onClick={() => onSelectTab("settings-privacy")}
            className={`w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-sm text-body-sm ${
              isActive("settings-privacy")
                ? "bg-surface-container-lowest text-on-surface font-semibold"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-lg leading-none">
              settings
            </span>
            <span>Settings &amp; Privacy</span>
          </button>
        </nav>
        <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-[#e8dfd3] shadow-[0_1px_3px_rgba(36,35,33,0.03)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="font-mono-data text-[0.6875rem] text-on-surface font-medium truncate">
                Cluster: Operational (v4.2)
              </span>
            </div>
            <span className="font-mono-data text-[0.625rem] text-outline">
              {clusterLatencyMs ? `${clusterLatencyMs}ms` : "340ms"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default EnterpriseSidebar;
