"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ConversationLayoutContextType {
  rightPanel: ReactNode | null;
  setRightPanel: (panel: ReactNode | null) => void;
}

const ConversationLayoutContext = createContext<ConversationLayoutContextType | undefined>(undefined);

export function ConversationLayoutProvider({ children }: { children: ReactNode }) {
  const [rightPanel, setRightPanel] = useState<ReactNode | null>(null);

  return (
    <ConversationLayoutContext.Provider value={{ rightPanel, setRightPanel }}>
      {children}
    </ConversationLayoutContext.Provider>
  );
}

export function useConversationLayout() {
  const context = useContext(ConversationLayoutContext);
  if (!context) {
    throw new Error("useConversationLayout must be used within ConversationLayoutProvider");
  }
  return context;
}

