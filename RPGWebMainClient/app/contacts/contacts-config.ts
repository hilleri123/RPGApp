/**
 * Контакты площадки. Заполняются владельцем инсталляции.
 *
 * Пункты со значением null не отображаются на странице — так можно
 * убрать неиспользуемые каналы, не трогая разметку.
 */
export interface ContactChannel {
  /** Что это за канал: «Почта», «Telegram», … */
  label: string;
  /** Как показать пользователю: адрес, @ник. */
  value: string | null;
  /** Куда ведёт клик. null — контакт не кликабельный. */
  href: string | null;
  /** Короткое пояснение: с чем сюда идти. */
  hint: string;
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: 'Почта',
    // TODO: подставьте адрес поддержки.
    value: null,
    href: null,
    hint: 'Общие вопросы, доступ к площадке, права мастера.',
  },
  {
    label: 'Telegram-бот',
    // TODO: подставьте @имя вашего бота.
    value: null,
    href: null,
    hint: 'Вход по одноразовой ссылке и создание лобби прямо из чата партии.',
  },
  {
    label: 'Чат сообщества',
    // TODO: подставьте ссылку на чат или уберите этот пункт.
    value: null,
    href: null,
    hint: 'Поиск игроков и мастеров, обсуждение партий.',
  },
  {
    label: 'Сообщить об ошибке',
    // TODO: подставьте адрес трекера или почту для багрепортов.
    value: null,
    href: null,
    hint: 'Опишите, что делали и что ожидали увидеть. Скриншот сильно помогает.',
  },
];

/** Руководство пользователя. Файл кладёт в public/ скрипт docs/build.sh. */
export const USER_GUIDE = {
  href: '/rpg-master-user-guide.pdf',
  fileName: 'rpg-master-user-guide.pdf',
} as const;
