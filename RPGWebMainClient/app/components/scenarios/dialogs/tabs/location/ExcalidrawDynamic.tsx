import dynamic from 'next/dynamic';
import type { ExcalidrawProps } from '@excalidraw/excalidraw/types/types';

const ExcalidrawDynamic = dynamic(
  () => import('./ExcalidrawWrapper'),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: '100%' }}
        className="bg-[#0f1117] flex items-center justify-center">
        <span className="text-gray-500 text-sm">Загрузка холста...</span>
      </div>
    ),
  }
);

export default ExcalidrawDynamic;