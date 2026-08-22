'use client';

import React from "react";

interface TimeHighlightProps {
  dt: string | undefined;
  className?: string;
}


export const TimeHighlight: React.FC<TimeHighlightProps> = ({ dt, className = "" }) => {
  if (!dt) return null;

  // Всегда парсим как UTC
  const dateRaw = dt.endsWith("Z") ? dt : dt + "Z";
  const msgDate = new Date(dateRaw);

  const now = Date.now();
  const deltaSec = (now - msgDate.getTime()) / 1000;

  const showTime = [
    msgDate.getHours().toString().padStart(2, "0"),
    msgDate.getMinutes().toString().padStart(2, "0"),
    msgDate.getSeconds().toString().padStart(2, "0"),
  ].join(":");

  let style: React.CSSProperties = {};

  if (deltaSec < 60) {
    const percent = Math.max(0, 1 - deltaSec / 60);
    style = {
      background: `linear-gradient(90deg, rgba(0,180,255,${0.18 + percent*0.22}) 0%, rgba(255,255,255,0.13) 100%)`,
      borderRadius: "4px",
      padding: "0 4px",
      transition: "background 0.3s",
    };
  } else if (deltaSec < 300) {
    const percent = Math.max(0, 1 - (deltaSec - 60) / 240);
    style = {
      background: `linear-gradient(90deg, rgba(180,180,255,${0.07 * percent}) 0%, transparent 100%)`,
      borderRadius: "4px",
      padding: "0 4px",
      transition: "background 0.3s",
    };
  }

  return (
    <span className={className} style={style}>{showTime}</span>
  );
};
