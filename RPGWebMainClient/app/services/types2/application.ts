export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_changes'
  | 'approved'
  | 'rejected';

export type ItemRequestStatus = 'pending' | 'approved' | 'rejected' | 'modified';

// ── Вложенные объекты ─────────────────────────────────────────────────────────

export interface AppAuthor {
  id: string;
  full_name?: string | null;
  icon_url?: string | null;
}

export interface ApplicationReview {
  id: string;
  application_id: string;
  author?: AppAuthor | null;
  status_set_to: ApplicationStatus;
  comment?: string | null;
  proposed_data?: Record<string, unknown> | null;
  is_player_note: boolean;
  created_at: string;
}

export interface ItemRequest {
  id: string;
  application_id: string;
  requested_item_id?: string | null;
  requested_name?: string | null;
  player_comment?: string | null;
  status: ItemRequestStatus;
  master_comment?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export interface GrantedItem {
  id: string;
  application_id: string;
  item_id: string;
  item_request_id?: string | null;
  master_comment?: string | null;
  granted_at: string;
  granted_by_id?: string | null;
}

// ── Списочная карточка (игрок + мастер) ──────────────────────────────────────

export interface ApplicationListItem {
  id: string;
  rule_id_str: string;
  name: string;
  short_desc?: string | null;
  status: ApplicationStatus;
  icon_url?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  /** Только в ответах мастера */
  user?: AppAuthor | null;
}

// ── Полная заявка ─────────────────────────────────────────────────────────────

export interface Application extends ApplicationListItem {
  story?: string | null;
  data?: Record<string, unknown> | null;
  img_url?: string | null;
  player_comment?: string | null;
  reviews: ApplicationReview[];
  item_requests: ItemRequest[];
  granted_items: GrantedItem[];
}

// ── Входящие payload-ы ────────────────────────────────────────────────────────

/** POST /applications */
export interface ApplicationCreatePayload {
  rule_id_str: string;
  name: string;
  short_desc?: string;
  story?: string;
  tags?: string[];
  data?: Record<string, unknown>;
  player_comment?: string;
}

/** PUT /applications/{id} — JSON-часть внутри FormData */
export interface ApplicationUpdatePayload {
  name?: string;
  short_desc?: string;
  story?: string;
  tags?: string[];
  data?: Record<string, unknown>;
  player_comment?: string;
  icon_url?: string;
  img_url?: string;
}

/** POST /applications/{id}/item-requests */
export interface ItemRequestCreatePayload {
  requested_item_id?: string;
  requested_name?: string;
  player_comment?: string;
}

/** POST /master/applications/{id}/review */
export interface MasterReviewPayload {
  new_status: ApplicationStatus;
  comment?: string;
  proposed_data?: Record<string, unknown>;
}

/** POST /master/applications/{id}/decide-item-request/{rid} */
export interface ItemRequestDecisionPayload {
  status: Exclude<ItemRequestStatus, 'pending'>;
  master_comment?: string;
}

/** POST /lobbies/{id}/finish-session */
export interface CharacterSessionUpdate {
  application_id: string;
  data?: Record<string, unknown>;
  story_append?: string;
  tags_add?: string[];
}
