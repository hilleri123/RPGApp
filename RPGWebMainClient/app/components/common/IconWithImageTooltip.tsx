'use client';

import React, { ElementType, ReactNode } from "react";
import { MessageCircleQuestionIcon, Package } from "lucide-react";

// Типы для тултипа
type TooltipProps = {
  children: ReactNode;
  content?: ReactNode;
};

// Простой Tooltip на чистом React+TS
const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <span
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 8,
            padding: 8,
            background: "#fff",
            border: "1px solid #ccc",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            borderRadius: 4,
            zIndex: 999,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
};

// Типы для основного компонента
type IconWithImageTooltipProps = {
  baseIcon?: ElementType<{ size?: number; color?: string }>;
  iconColor?: string;
  customIconUrl?: string;
  imageSrc?: string;
  size?: number;
};

export default function IconWithImageTooltip({
  baseIcon: BaseIcon = MessageCircleQuestionIcon,
  iconColor = "#2563eb",
  customIconUrl,
  imageSrc,
  size = 16,
}: IconWithImageTooltipProps) {
  const icon = customIconUrl ? (
    <img
      src={customIconUrl}
      alt="custom icon"
      width={size}
      height={size}
      style={{ color: iconColor, display: "block" }}
    />
  ) : (
    <BaseIcon size={size} color={iconColor} />
  );

  if (imageSrc) {
    return (
      <Tooltip
        content={
          <img
            src={imageSrc}
            alt="tooltip"
            style={{ maxWidth: 160, maxHeight: 160, borderRadius: 4 }}
          />
        }
      >
        <span
          style={{
            display: "inline-block",
            padding: 4,
            border: `2px solid ${iconColor}`,
            borderRadius: 12,
            background: "#f3f4f6",
            cursor: "pointer",
          }}
        >
          {icon}
        </span>
      </Tooltip>
    );
  }

  return icon;
};

