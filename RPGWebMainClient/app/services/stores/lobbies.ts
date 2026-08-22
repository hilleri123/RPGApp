// store/lobbies.ts
import { create } from 'zustand';
import { Lobby, Player } from '@/app/services/types/lobby';

type LobbyState = {
  lobbies: Record<string, Lobby>;         // Список лобби по id
  selfPlayers: Record<string, Player | null>; // Свои игроки по id лобби
  updateLobby: (lobby: Lobby) => void;
  setSelfPlayer: (id: string, player: Player | null) => void;
  clearLobby: (id: string) => void;
};

export const useLobbiesStore = create<LobbyState>((set) => ({
  lobbies: {},
  selfPlayers: {},
  updateLobby: (lobby) => {
    set((state) => ({
      lobbies: { ...state.lobbies, [lobby.id]: lobby }
    }))
  },
  setSelfPlayer: (id, player) => set((state) => ({
    selfPlayers: { ...state.selfPlayers, [id]: player }
  })),
  clearLobby: (id) => set((state) => {
    const lobbies = { ...state.lobbies }; delete lobbies[id];
    const selfPlayers = { ...state.selfPlayers }; delete selfPlayers[id];
    return { lobbies, selfPlayers };
  }),
}));
