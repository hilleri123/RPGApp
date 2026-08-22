// components/sessions/SessionCard.tsx
import { GameSessionPreview } from "@/app/services/types/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from 'next/navigation';

export default function SessionCard({ session }: { session: GameSessionPreview }) {
  const router = useRouter();
  return (
    <Card
      className="bg-gray-700 border-gray-800 hover:bg-gray-750 transition-all duration-300"
    >
      <CardHeader>
        <CardTitle>{session.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-400 mb-2">
          Сценарий: {session.scenario?.name}
        </div>
        <div className="text-xs text-gray-500">
          Создана: {session.created_at && new Date(session.created_at).toLocaleString()}
        </div>
        <div className="mt-2">
          <Button
            className="text-white-500 bg-blue-400 hover:underline text-sm"
            onClick={() => { router.push(`/session/${session.id}`); }}
          >
            Перейти к сессии
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
