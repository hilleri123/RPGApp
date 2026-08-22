// components/common/BaseFeedRow.tsx
'use client';

import React from "react";
import { TimeHighlight } from "./TimeHighlight";

interface BaseFeedRowProps {
  id: string;                 // для key
  dt?: string;                // ISO время (опционально)
  children: React.ReactNode;  // уже отрендеренный текст/контент
}

export function BaseFeedRow({ id, dt, children }: BaseFeedRowProps) {
  const timeLabel = dt ? new Date(dt).toLocaleTimeString() : "";

  return (
    <div
      key={id}
      className="flex px-2 py-1 even:bg-gray-900 odd:bg-gray-950 rounded gap-2"
    >
      {dt && (
        <TimeHighlight dt={dt} />
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
