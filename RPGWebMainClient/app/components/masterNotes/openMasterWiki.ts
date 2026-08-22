import { useMasterUiStore } from '@/app/services/stores/masterUi';

/** Open Wiki tab and start a new note (session master UI). */
export function openMasterWikiCreate() {
  const { requestWikiTab, requestWikiCreate } = useMasterUiStore.getState();
  requestWikiTab();
  requestWikiCreate();
}

/** Open Wiki tab only. */
export function openMasterWikiTab() {
  useMasterUiStore.getState().requestWikiTab();
}
