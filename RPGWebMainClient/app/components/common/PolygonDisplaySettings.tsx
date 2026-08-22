"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Upload,
  Save,
  Trash2,
  Edit,
  MapPin,
  Square,
  Circle,
  Triangle,
  Star,
  Home,
  Sword,
  Shield,
  Crown,
  Gem,
  Heart,
  Zap,
  Plus,
  Download,
  RotateCcw,
  Loader2,
} from "lucide-react"

export interface DrawingSettings {
  color: string;
  alpha: number;
  filled: boolean;
  closed: boolean;
  icon: string;
  icon_url: string;
}



const presetColors = [
  "#ff0000", // Красный
  "#00ff00", // Зеленый
  "#0000ff", // Синий
  "#ffff00", // Желтый
  "#ff00ff", // Пурпурный
  "#00ffff", // Циан
  "#ffa500", // Оранжевый
  "#800080", // Фиолетовый
  "#008000", // Темно-зеленый
  "#000080", // Темно-синий
]




export const availableIcons = [
  { name: "Нет", icon: null, value: "none" },
  { name: "Точка", icon: MapPin, value: "mappin" },
  { name: "Квадрат", icon: Square, value: "square" },
  { name: "Круг", icon: Circle, value: "circle" },
  { name: "Треугольник", icon: Triangle, value: "triangle" },
  { name: "Звезда", icon: Star, value: "star" },
  { name: "Дом", icon: Home, value: "home" },
  { name: "Меч", icon: Sword, value: "sword" },
  { name: "Щит", icon: Shield, value: "shield" },
  { name: "Корона", icon: Crown, value: "crown" },
  { name: "Кристалл", icon: Gem, value: "gem" },
  { name: "Сердце", icon: Heart, value: "heart" },
  { name: "Молния", icon: Zap, value: "zap" },
]


interface PolygonDisplaySettingsProps {
  drawingSettings: DrawingSettings;
  setDrawingSettings: React.Dispatch<React.SetStateAction<DrawingSettings>>
}


export function PolygonDisplaySettings({
  drawingSettings,
  setDrawingSettings
}: PolygonDisplaySettingsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-600">
      <h4 className="font-semibold">Настройки полигона</h4>

      {/* Цвет */}
      <div className="space-y-2">
        <Label>Цвет</Label>
        <div className="flex gap-2 flex-wrap">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => setDrawingSettings((prev) => ({ ...prev, color }))}
              className={`w-6 h-6 rounded border-2 ${
                drawingSettings.color === color ? "border-white" : "border-gray-600"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <Input
          type="color"
          value={drawingSettings.color}
          onChange={(e) => setDrawingSettings((prev) => ({ ...prev, color: e.target.value }))}
          className="w-full h-8"
        />
      </div>

      {/* Прозрачность */}
      <div className="space-y-2">
        <Label>Прозрачность: {Math.round(drawingSettings.alpha * 100)}%</Label>
        <Slider
          value={[drawingSettings.alpha]}
          onValueChange={([value]) => setDrawingSettings((prev) => ({ ...prev, alpha: value }))}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Настройки заполнения и замыкания */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="filled"
            checked={drawingSettings.filled}
            onCheckedChange={(checked) => setDrawingSettings((prev) => ({ ...prev, filled: !!checked }))}
          />
          <Label htmlFor="filled">Заполненный</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="closed"
            checked={drawingSettings.closed}
            onCheckedChange={(checked) => setDrawingSettings((prev) => ({ ...prev, closed: !!checked }))}
          />
          <Label htmlFor="closed">Замкнутый</Label>
        </div>
      </div>

      {/* Иконка */}
      <div className="space-y-2">
        <Label>Иконка в центре</Label>
        <Select
          value={drawingSettings.icon}
          onValueChange={(value) => setDrawingSettings((prev) => ({ ...prev, icon: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableIcons.map((icon) => (
              <SelectItem key={icon.value} value={icon.value}>
                <div className="flex items-center gap-2">
                  {icon.icon && <icon.icon className="w-4 h-4" />}
                  {icon.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
