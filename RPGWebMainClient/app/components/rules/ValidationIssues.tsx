'use client';

import { Issue } from "@/app/services/types2";


export default function ValidationIssues({ issues }: { issues?: Issue[] }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="space-y-2 bg-gray-950/60 border border-red-700 rounded-md p-3">
      <div className="text-red-400 text-sm font-semibold">Замечания валидации</div>
      <ul className="space-y-1">
        {issues.map((i) => (
          <li key={`${i.path ?? ''}|${i.message}`} className="text-sm text-gray-200">
            <span className="text-gray-400">{i.path || 'root'}:</span> {i.message}
            {i.level ? <span className="text-gray-500"> ({i.level})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
