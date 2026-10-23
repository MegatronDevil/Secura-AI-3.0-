import React, { useState } from "react";
import { NavTab } from "./EnterpriseSidebar";

interface EnterpriseHeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onAnalyzeMediaClick?: () => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  userDisplayName?: string;
  userRole?: string;
}

export const EnterpriseHeader: React.FC<EnterpriseHeaderProps> = ({
  currentTab,
  onSelectTab,
  onAnalyzeMediaClick,
  onLogout,
  onOpenAuth,
  userDisplayName = "Dr. Elena Vance",
  userRole = "Head of Digital Trust",
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-[#fbf8f4]/90 backdrop-blur-md border-b border-[#e9e2d7] z-40 flex items-center justify-between px-gutter select-none">
      {/* Search Input */}
      <div className="flex items-center gap-space-md flex-1 max-w-lg">
        <div className="relative w-full flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-outline text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search analyses, users, cases, policies..."
            className="w-full h-9 pl-10 pr-12 rounded-lg border border-[#e2d9cd] bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
          />
          <kbd className="absolute right-2 font-mono-data text-[0.625rem] px-1.5 py-0.5 rounded border border-[#dfd6c8] bg-surface-container-high/60 text-on-surface-variant font-medium">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-space-md">
        {/* Quick Tabs Pill */}
        <div className="flex items-center rounded-lg border border-[#e4dcce] bg-surface-container-lowest p-0.5 shadow-sm hidden md:flex">
          <button
            type="button"
            onClick={() => onSelectTab("overview")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              currentTab === "overview"
                ? "bg-[#f4ede3] text-on-surface"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("image-detection")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              currentTab === "image-detection" || currentTab === "video-detection"
                ? "bg-[#f4ede3] text-on-surface font-semibold rounded-md"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Forensics
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("rgb-rppg")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              currentTab === "rgb-rppg"
                ? "bg-[#f4ede3] text-on-surface font-semibold rounded-md"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Biometrics
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("social-feed")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              currentTab === "social-feed" || currentTab === "messages"
                ? "bg-[#f4ede3] text-primary-container font-semibold rounded-md"
                : "text-primary-container hover:text-primary"
            }`}
          >
            Secura Social
          </button>
        </div>

        {/* Analyze Media Dropdown */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-space-xs h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold hover:bg-[#d97322] transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">biotech</span>
            <span>Analyze Media</span>
            <span className="material-symbols-outlined text-base">arrow_drop_down</span>
          </button>

          {dropdownOpen && (
            <div className="absolute top-11 right-0 w-48 bg-surface-container-lowest rounded-xl shadow-lg border border-[#e4dcce] py-1.5 z-50 animate-fade-in font-body-sm text-xs">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onSelectTab("image-detection");
                  if (onAnalyzeMediaClick) onAnalyzeMediaClick();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-surface-container-low flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-base text-primary">image</span>
                <span>Analyze Still Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onSelectTab("video-detection");
                  if (onAnalyzeMediaClick) onAnalyzeMediaClick();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-surface-container-low flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-base text-primary">videocam</span>
                <span>Analyze Video Stream</span>
              </button>
            </div>
          )}
        </div>

        {/* Forensic Alerts */}
        <button
          type="button"
          aria-label="Forensic Alerts"
          onClick={() => onSelectTab("moderation-center")}
          className="relative p-2 rounded-lg text-on-surface-variant hover:bg-[#f1ebe2] hover:text-on-surface transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl leading-none">notifications</span>
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-on-error font-mono-data text-[0.5625rem] font-bold">
            3
          </span>
        </button>

        {/* Help button */}
        <button
          type="button"
          aria-label="Documentation & Help"
          onClick={() => onSelectTab("policy-intelligence")}
          className="p-2 rounded-lg text-on-surface-variant hover:bg-[#f1ebe2] hover:text-on-surface transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl leading-none">help_outline</span>
        </button>

        {/* Profile */}
        <div
          onClick={() => (onLogout ? onLogout() : onOpenAuth ? onOpenAuth() : null)}
          className="flex items-center gap-space-sm pl-space-xs border-l border-[#e5dcd1] cursor-pointer hover:opacity-80 transition-opacity"
          title={onLogout ? "Click to sign out" : "Click to sign in"}
        >
          <img
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover ring-1 ring-[#e4dcce]"
            src="https://lh3.googleusercontent.com/aida/AEtjO1WKjupt0RD_z_KOE_0nTvgWlC-P1anPi9xFAYKbqn6bDPvAYnyxrtuno0NF8jomGWJPjvAWAglLYbS5w3vvFvuyuoPhyG6AZ7ApIa6lmChc2J9s-qeCgnc6Sh59QR2IGWpmxncYgzY_LEUPix3lnUGAhwk7K085QfB0rx_KVVpw_vVfGfDN_nAmeoEu22VZLdS5Yu6K5Rd4R4lYE3preOhFOOBrRVTWUYyxw9c49VcknA-Mo6Re-LCV-do"
          />
          <div className="hidden xl:flex flex-col text-left">
            <span className="font-label-sm text-label-sm text-on-surface font-semibold leading-tight">
              {userDisplayName}
            </span>
            <span className="font-mono-data text-[0.6875rem] text-on-surface-variant leading-tight">
              {userRole}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default EnterpriseHeader;
