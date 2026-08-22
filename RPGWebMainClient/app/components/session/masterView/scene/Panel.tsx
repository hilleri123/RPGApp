'use client';

import type React from 'react';

export default function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-gray-800 bg-gray-950 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-gray-400">{title}</div>
          {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
