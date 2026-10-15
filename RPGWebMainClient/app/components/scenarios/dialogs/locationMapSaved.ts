const CHANNEL = 'rpg-location-map';

export type LocationMapSavedMessage = {
  scenarioId: string;
  locationId: string;
  name: string;
};

export function notifyLocationMapSaved(message: LocationMapSavedMessage) {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in this browser.
  }
}

export function listenLocationMapSaved(
  onMessage: (message: LocationMapSavedMessage) => void,
): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<LocationMapSavedMessage>) => {
      const data = event.data;
      if (!data?.scenarioId || !data.locationId) return;
      onMessage(data);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}
