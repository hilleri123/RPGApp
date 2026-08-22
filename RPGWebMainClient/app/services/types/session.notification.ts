import { GameItem, Note } from "../types2";

export type NotificationType =
  | "action_eval"
  | "use_eval"
  | "note_shown"
  // | "other_notifications" // Добавь другие типы по аналогии
  ;

export interface NotificationBase {
  id: string; // UUID, как строка
  dt: string; // ISO/UTC datetime
  notif_type: NotificationType;
  initiator_id: string; // UUID как строка
  recipients: string[]; // массив UUID-строк
  readed_by?: string[]; // массив UUID-строк
}


export interface NoteShownNotification extends NotificationBase {
  notif_type: "note_shown";
  note: Note;
}


export type SessionNotification =
  | NoteShownNotification
  // | OtherNotificationTypes...
  ;
