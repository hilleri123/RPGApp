export type MapBaseline = {
  form: any;
  mapFile: File | null;
};

export type MapBaselinePair = {
  original: MapBaseline;
  committed: MapBaseline;
};

const storageKey = (scenarioId: string, locationId: string) =>
  `rpg-map-baseline:${scenarioId}:${locationId}`;

function cloneForm(form: any) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(form);
    } catch {
      // Fall through to JSON for values structuredClone cannot copy.
    }
  }
  return JSON.parse(JSON.stringify(form));
}

function fileFromDataUrl(dataUrl: string): File {
  const [header, body] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(header)?.[1] || 'image/png';
  const binary = atob(body || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  return new File([bytes], `map-background.${ext}`, { type: mime });
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function fetchMapFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type || 'image/png';
    const ext = type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png';
    return new File([blob], `map-background.${ext}`, { type });
  } catch {
    return null;
  }
}

function baselineFromStored(stored: { form: any; imageDataUrl?: string | null } | null | undefined): MapBaseline | null {
  if (!stored?.form) return null;
  return {
    form: stored.form,
    mapFile: stored.imageDataUrl ? fileFromDataUrl(stored.imageDataUrl) : null,
  };
}

async function packBaseline(baseline: MapBaseline) {
  return {
    form: baseline.form,
    imageDataUrl: baseline.mapFile ? await fileToDataUrl(baseline.mapFile) : null,
  };
}

export function readMapBaselines(scenarioId: string, locationId: string): MapBaselinePair | null {
  try {
    const raw = sessionStorage.getItem(storageKey(scenarioId, locationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      form?: any;
      imageDataUrl?: string | null;
      original?: { form: any; imageDataUrl?: string | null };
      committed?: { form: any; imageDataUrl?: string | null };
    };
    const original = baselineFromStored(parsed.original) ?? baselineFromStored(parsed);
    if (!original) return null;
    const committed = baselineFromStored(parsed.committed) ?? original;
    return { original, committed };
  } catch {
    return null;
  }
}

export async function writeMapBaseline(
  scenarioId: string,
  locationId: string,
  baseline: MapBaseline,
) {
  try {
    const packed = await packBaseline(baseline);
    sessionStorage.setItem(
      storageKey(scenarioId, locationId),
      JSON.stringify({ original: packed, committed: packed }),
    );
  } catch {
    // The in-memory snapshot still restores this dialog if storage is full.
  }
}

export async function writeCommittedBaseline(
  scenarioId: string,
  locationId: string,
  committed: MapBaseline,
) {
  try {
    const raw = sessionStorage.getItem(storageKey(scenarioId, locationId));
    const parsed = raw ? JSON.parse(raw) : null;
    const packed = await packBaseline(committed);
    const original = parsed?.original ?? packed;
    sessionStorage.setItem(
      storageKey(scenarioId, locationId),
      JSON.stringify({ original, committed: packed }),
    );
  } catch {
    // The in-memory snapshot still keeps this save inside the open dialog.
  }
}

export function clearMapBaseline(scenarioId: string, locationId: string) {
  try {
    sessionStorage.removeItem(storageKey(scenarioId, locationId));
  } catch {
    // Ignore storage failures.
  }
}

export async function captureMapBaseline(form: any): Promise<MapBaseline> {
  const snapshot = cloneForm(form);
  const mapFile = snapshot?.map_url ? await fetchMapFile(String(snapshot.map_url)) : null;
  return { form: snapshot, mapFile };
}

export function cloneBaselineForm(baseline: MapBaseline) {
  return cloneForm(baseline.form);
}
