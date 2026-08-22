'use client';

import { useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/app/services/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useLobbiesStore } from '../stores/lobbies';
import { LobbySocketContext, MISSING_LOBBY_SOCKET } from '@/app/services/providers/LobbyWebSocketProvider';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import { ScenarioScopedApiService } from '../api/scenario_scoped';
import type { EntityKind } from '../types2';
import { loadPluginEditorConfigForEntity } from '@/app/services/loadPluginEditorConfigs';

export function useLobbyWebSocket(lobbyId: string) {
  const router = useRouter();
  const {
    state: { user },
  } = useAuth();

  const lobby = useLobbiesStore((s) => s.lobbies[lobbyId]);
  const selfPlayer = lobby?.players?.find((p: any) => p.user.id === user?.id) || null;

  // Хуки ниже должны вызываться безусловно: throw при отсутствии контекста
  // менял их количество между рендерами (см. MISSING_LOBBY_SOCKET).
  const lobbySocketContext = useContext(LobbySocketContext);
  const { socket, connected, sendAction, lobbyError, clearLobbyError } =
    lobbySocketContext ?? MISSING_LOBBY_SOCKET;

  // ===== scenario/plugin (стабильные зависимости через примитивы) =====
  const scenarioId = useMemo(
    () => (lobby?.scenario?.id ? String(lobby.scenario.id) : null),
    [lobby?.scenario?.id]
  );

  const selectedScenario = lobby?.scenario ?? null;

  const pluginId = useMemo(() => {
    const v = (selectedScenario as any)?.rule_id_str ?? null;
    return v ? String(v) : null;
  }, [scenarioId]); // достаточно scenarioId, т.к. plugin меняется вместе со сценарием

  const pluginUI = useMemo(() => (pluginId ? getPluginUI(pluginId) : null), [pluginId]);

  const api = useMemo(() => (scenarioId ? new ScenarioScopedApiService(scenarioId) : null), [scenarioId]);

  // ===== configs loading =====
  // Стабильные "опции", чтобы не триггерить эффекты ссылками
  const loadConfigFor = useMemo((): EntityKind[] => ['character'], []);

  const [configs, setConfigs] = useState<Partial<Record<EntityKind, any>>>({});
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  // ручной reload без зависимостей
  const [reloadKey, setReloadKey] = useState(0);
  const reloadConfigs = useCallback(() => setReloadKey((x) => x + 1), []);

  useEffect(() => {
    if (!api || !scenarioId) {
      setConfigs({});
      setRulesLoading(false);
      setRulesError(null);
      return;
    }

    if (!loadConfigFor.length) {
      setConfigs({});
      setRulesLoading(false);
      setRulesError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setRulesLoading(true);
      setRulesError(null);

      try {
        const pairs = await Promise.all(
          loadConfigFor.map(async (k) => {
        const cfg = await loadPluginEditorConfigForEntity({
          scope: { scope: 'scenario', id: scenarioId },
          entity: k,
          needInit: false,
          fetchSchema: (entity, etag) => api!.getEntitySchema(entity, etag),
        });
            return [k, cfg] as const;
          })
        );

        if (cancelled) return;

        const dict: Partial<Record<EntityKind, any>> = {};
        for (const [k, cfg] of pairs) dict[k] = cfg;
        setConfigs(dict);
      } catch (e: any) {
        if (!cancelled) {
          setConfigs({});
          setRulesError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, scenarioId, reloadKey, loadConfigFor]);

  const config = useMemo(() => {
    const first = loadConfigFor[0];
    return first ? configs[first] ?? null : null;
  }, [configs, loadConfigFor]);

  // ===== actions =====
  const masterSelectScenario = useCallback(
    (scenarioId: string) => {
      sendAction({ user_role: 'master', msg_type: 'select_scenario', scenario_id: scenarioId });
    },
    [sendAction]
  );

  const masterSelectLaunchedScenario = useCallback(
    (launchedScenarioId: string) => {
      sendAction({
        user_role: 'master',
        msg_type: 'select_launched_scenario',
        launched_scenario_id: launchedScenarioId,
      });
    },
    [sendAction],
  );

  const masterSelectCampaign = useCallback(
    (campaignId: string) => {
      sendAction({ user_role: 'master', msg_type: 'select_campaign', campaign_id: campaignId });
    },
    [sendAction]
  );

  const masterSelectParty = useCallback(
    (partyId: string) => {
      sendAction({ user_role: 'master', msg_type: 'select_party', party_id: partyId });
    },
    [sendAction],
  );

  const masterKickPlayer = useCallback(
    (playerId: string) => {
      sendAction({ user_role: 'master', msg_type: 'kick_player', player_id: playerId });
    },
    [sendAction]
  );

  const masterPlayerDeselectCharacter = useCallback(
    (playerId: string, userId?: string) => {
      sendAction({
        user_role: 'master',
        msg_type: 'master_deselect_character',
        player_id: playerId,
        ...(userId ? { user_id: userId } : {}),
      });
    },
    [sendAction]
  );

  const masterStartSession = useCallback(() => {
    sendAction({ user_role: 'master', msg_type: 'start_session' });
  }, [sendAction]);

  const masterCloseLobby = useCallback(() => {
    sendAction({ user_role: 'master', msg_type: 'close_lobby' });
  }, [sendAction]);

  const playerSelectCharacter = useCallback(
    (characterId: string) => {
      sendAction({ user_role: 'player', msg_type: 'select_character', character_id: characterId });
    },
    [sendAction]
  );

  const playerSelectApplicationCharacter = useCallback(
    (applicationId: string) => {
      sendAction({
        user_role: 'player',
        msg_type: 'select_application_character',
        application_id: applicationId,
      });
    },
    [sendAction]
  );

  const playerDeselectCharacter = useCallback(() => {
    sendAction({ user_role: 'player', msg_type: 'deselect_character' });
  }, [sendAction]);

  const playerReady = useCallback(
    (is_ready: boolean) => {
      sendAction({ user_role: 'player', msg_type: 'player_ready', is_ready });
    },
    [sendAction]
  );

  const selectColor = useCallback((color: string) => {
    sendAction({ user_role: 'player', msg_type: 'select_color', color: color });
  }, [sendAction]);

  const userBecomePlayer = useCallback(
    (playerName: string) => {
      sendAction({ user_role: 'user', msg_type: 'user_become_player', player: { name: playerName } });
    },
    [sendAction]
  );

  const userLeave = useCallback(() => {
    sendAction({ user_role: 'user', msg_type: 'user_leave' });
  }, [sendAction]);

  // ===== flags =====
  const isMaster = lobby?.master?.id === user?.id;
  const isPlayer = !!selfPlayer;
  const isUser = !!(lobby?.users?.find((u: any) => u.id === user?.id));

  return {
    lobby,
    connected,
    socket,
    selfPlayer,

    isMaster,
    isPlayer,
    isUser,

    selectedScenario,
    scenarioId,

    pluginId,
    pluginUI,

    configs,
    config,
    rulesLoading,
    rulesError,
    reloadConfigs,

    masterSelectScenario,
    masterSelectLaunchedScenario,
    masterSelectCampaign,
    masterSelectParty,
    masterKickPlayer,
    masterPlayerDeselectCharacter,
    masterStartSession,
    masterCloseLobby,

    playerSelectCharacter,
    playerSelectApplicationCharacter,
    playerDeselectCharacter,
    playerReady,
    selectColor,

    userBecomePlayer,
    userLeave,

    lobbyError,
    clearLobbyError,
  };
}
