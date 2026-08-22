// app/scenarios/[scenarioId]/layout.tsx
import { ScenarioProvider } from '@/app/components/scenarios/ScenarioContext';
  
export default async function ScenarioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScenarioProvider scenarioId={id}>{children}</ScenarioProvider>;
}
