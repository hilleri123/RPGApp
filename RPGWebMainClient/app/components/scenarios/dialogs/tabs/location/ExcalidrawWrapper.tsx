'use client';

import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawProps } from '@excalidraw/excalidraw/types/types';

export default function ExcalidrawWrapper(props: ExcalidrawProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw {...props} />
    </div>
  );
}