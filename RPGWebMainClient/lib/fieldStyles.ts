/** Единые стили полей ввода для тёмной темы приложения. */
export const fieldControlBase =
  'w-full rounded border border-gray-600 bg-gray-800 text-white placeholder:text-gray-400 shadow-none ring-offset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

export const fieldControlMd = `flex h-10 ${fieldControlBase} px-3 py-2 text-sm md:text-sm`;

export const fieldControlSm = `flex h-8 ${fieldControlBase} px-2.5 py-1 text-xs`;

export const fieldTextarea = `flex min-h-[80px] ${fieldControlBase} px-3 py-2 text-sm resize-y`;

export const fieldPopoverSurface =
  'bg-gray-800 border-gray-600 text-white';

export const fieldMenuItem =
  'text-gray-100 focus:bg-gray-700 focus:text-white data-[highlighted]:bg-gray-700 data-[highlighted]:text-white';

export const fieldComboboxTrigger =
  `${fieldControlMd} justify-between font-normal hover:bg-gray-700 hover:text-white`;
