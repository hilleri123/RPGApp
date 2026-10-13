'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { masterApplicationApiService } from '@/app/services/api/application';
import type { ApplicationListItem } from '@/app/services/types2';

const POLL_MS = 60_000;

type InboxState = {
  items: ApplicationListItem[];
  loaded: boolean;
};

const EMPTY: InboxState = { items: [], loaded: false };

let state: InboxState = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
let users = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function arrivalStamp(app: ApplicationListItem) {
  return app.submitted_at || app.updated_at;
}

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [submitted, inReview] = await Promise.all([
        masterApplicationApiService.getList({ status: 'submitted', limit: 100 }),
        masterApplicationApiService.getList({ status: 'in_review', limit: 100 }),
      ]);
      const items = [...submitted, ...inReview].sort((a, b) =>
        arrivalStamp(b).localeCompare(arrivalStamp(a)),
      );
      state = { items, loaded: true };
      emit();
    } catch {
      if (!state.loaded) {
        state = { items: state.items, loaded: true };
        emit();
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function retain() {
  users += 1;
  if (users === 1) {
    void refresh();
    timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
  }
  return () => {
    users -= 1;
    if (users <= 0) {
      users = 0;
      if (timer) clearInterval(timer);
      timer = null;
    }
  };
}

/** Заявки, которые ждут мастера. Один опрос на все подписчики, раз в минуту. */
export function useMasterApplicationInbox(enabled: boolean): InboxState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!enabled) return;
    return retain();
  }, [enabled]);
  return enabled ? snapshot : EMPTY;
}

export function applicationArrivalStamp(app: ApplicationListItem) {
  return arrivalStamp(app);
}
