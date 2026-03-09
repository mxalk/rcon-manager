import { useEffect, useState } from "react";

import type { PublicUser } from "../../lib/types.js";
import {
  getSelectedServerFromUrl,
  getViewFromUrl,
  setSelectedServerInUrl,
  setViewInUrl,
  type AppTab
} from "../model/state.js";

export function useNavigationState(user: PublicUser | null) {
  const [activeTabState, setActiveTabState] = useState<AppTab>(() => getViewFromUrl());
  const [selectedServerId, setSelectedServerId] = useState<string>(() => getSelectedServerFromUrl());
  const activeTab: AppTab =
    user && user.role !== "admin" && activeTabState === "users" ? "console" : activeTabState;

  useEffect(() => {
    setViewInUrl(activeTab);
  }, [activeTab]);

  useEffect(() => {
    setSelectedServerInUrl(selectedServerId, activeTab);
  }, [selectedServerId, activeTab]);

  function setActiveTab(tab: AppTab) {
    if (tab === "users" && user?.role !== "admin") {
      setActiveTabState("console");
      return;
    }
    setActiveTabState(tab);
  }

  return {
    activeTab,
    setActiveTab,
    selectedServerId,
    setSelectedServerId
  };
}
