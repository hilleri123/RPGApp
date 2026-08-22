'use client';

import React, { createContext, useContext, useMemo } from 'react';

export type PlayerMirrorContextValue = {
  enabled: true;
  playerUserId: string;
  readOnly: true;
};

const PlayerMirrorContext = createContext<PlayerMirrorContextValue | null>(null);

export function PlayerMirrorProvider({
  playerUserId,
  children,
}: {
  playerUserId: string;
  children: React.ReactNode;
}) {
  const value = useMemo<PlayerMirrorContextValue>(
    () => ({
      enabled: true,
      playerUserId: String(playerUserId),
      readOnly: true,
    }),
    [playerUserId],
  );

  return <PlayerMirrorContext.Provider value={value}>{children}</PlayerMirrorContext.Provider>;
}

export function usePlayerMirrorContext(): PlayerMirrorContextValue | null {
  return useContext(PlayerMirrorContext);
}

export function useIsPlayerMirror(): boolean {
  return Boolean(usePlayerMirrorContext()?.enabled);
}
