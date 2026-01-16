'use client';

type Props = {
  data: Record<string, any>;
  config?: any; // если захочешь группировать по config
};

export default function CharacterDataView({ data }: Props) {
  // Временный универсальный viewer: красиво выводит data JSON.
  // Потом заменишь на конкретное отображение (скиллы/группы/поинты).
  return (
    <pre className="text-xs bg-black/30 border border-gray-700 rounded-md p-2 overflow-x-auto">
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}
