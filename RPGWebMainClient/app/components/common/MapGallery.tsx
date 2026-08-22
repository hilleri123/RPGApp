'use client';

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { imagesApiService } from "@/app/services/api/images";

interface ImagePickerProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onSelect: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
  filter?: string;
  title?: string;
  buttonText?: string;
}

export default function ImagePicker({
  icon,
  onSelect,
  onUpload,
  filter,
  title = "Выбор фона карты",
  buttonText = "Выбрать фон карты",
}: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchImages = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const tmp = await imagesApiService.getImages(filter);
      setImages(tmp);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
      fetchImages();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const IconComponent = icon;

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      await onUpload(file);
      fetchImages();
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Button variant="ghost" className="sm" onClick={() => setOpen(true)}>
        {icon && <IconComponent className="w-4 h-4" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 flex-col md:flex-row">
            {/* Галерея: прокручиваемая */}
            <div className="flex-1 min-w-[140px]">
              <div className="font-medium mb-2 text-xs text-gray-400">Галерея</div>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto"
                style={{ maxHeight: 260, minHeight: 110 }}
              >
                {loading ? (
                  <div>Загрузка...</div>
                ) : images.map((url) => (
                  <button
                    key={url}
                    className="aspect-[4/3] bg-gray-100 rounded border hover:border-blue-500 overflow-hidden"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelect(url);
                    }}
                  >
                    <img src={url} alt="" className="object-cover w-full h-full" />
                  </button>
                ))}
                {!loading && images.length === 0 && (
                  <div className="col-span-2 text-xs text-gray-400">Нет загруженных файлов</div>
                )}
              </div>
            </div>
            {/* Большая зона загрузки */}
            <div className="w-full max-w-xs flex flex-col gap-4">
              <div className="font-medium mb-2 text-xs text-gray-400">Загрузить файл</div>
              <label
                htmlFor="img-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 py-6 px-3 cursor-pointer hover:bg-gray-100 transition"
                style={{ minHeight: 120 }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <Plus className="w-6 h-6 text-blue-500 mb-2" />
                <span className="text-base text-gray-700 mb-2">Перетащите или выберите изображение</span>
                <input
                  id="img-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={inputRef}
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {uploading && <div className="text-xs text-blue-600 mt-2">Загрузка...</div>}
                {!uploading && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {buttonText}
                  </Button>
                )}
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
