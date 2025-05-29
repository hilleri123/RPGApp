import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PropertyTemplate } from '@/app/rules/types'


interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (propertyData: Omit<PropertyTemplate, 'id'> & { id?: string }) => void;
  property?: PropertyTemplate | null;
}

const PROPERTY_TYPES = [
  { value: 'number', label: 'Число' },
  { value: 'text', label: 'Текст' },
  { value: 'boolean', label: 'Да/Нет' },
  { value: 'select', label: 'Выбор из списка' }
];

const PROPERTY_CATEGORIES = [
  { value: 'attributes', label: 'Атрибуты' },
  { value: 'skills', label: 'Навыки' },
  { value: 'equipment', label: 'Снаряжение' },
  { value: 'status', label: 'Состояние' },
  { value: 'other', label: 'Прочее' }
];

export default function PropertyModal({
  isOpen,
  onClose,
  onSave,
  property
}: PropertyModalProps) {
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    type: 'number' as PropertyTemplate['type'],
    defaultValue: '',
    options: [''],
    min: 0,
    max: 100,
    required: true,
    category: 'attributes'
  });

  // Обновляем форму при изменении property
  React.useEffect(() => {
    if (property) {
      setFormData({
        name: property.name,
        description: property.description,
        type: property.type,
        defaultValue: String(property.defaultValue),
        options: property.options || [''],
        min: property.min || 0,
        max: property.max || 100,
        required: property.required,
        category: property.category
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'number',
        defaultValue: '',
        options: [''],
        min: 0,
        max: 100,
        required: true,
        category: 'attributes'
      });
    }
  }, [property]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.category) {
      return;
    }

    let processedDefaultValue: string | number | boolean = formData.defaultValue;
    
    if (formData.type === 'number') {
      processedDefaultValue = Number(formData.defaultValue) || 0;
    } else if (formData.type === 'boolean') {
      processedDefaultValue = formData.defaultValue === 'true';
    }

    const cleanOptions = formData.options.filter(opt => opt.trim()).map(opt => opt.trim());

    onSave({
      ...(property && { id: property.id }),
      name: formData.name.trim(),
      description: formData.description.trim(),
      type: formData.type,
      defaultValue: processedDefaultValue,
      ...(formData.type === 'select' && { options: cleanOptions }),
      ...(formData.type === 'number' && { 
        min: formData.min, 
        max: formData.max 
      }),
      required: formData.required,
      category: formData.category
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type: 'number',
      defaultValue: '',
      options: [''],
      min: 0,
      max: 100,
      required: true,
      category: 'attributes'
    });
    onClose();
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const isEditing = !!property;
  const canSave = formData.name.trim() && formData.category;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-800 border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {isEditing ? 'Редактировать свойство' : 'Добавить свойство'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Название свойства */}
            <div className="space-y-2">
              <Label htmlFor="property-name" className="text-white">
                Название свойства *
              </Label>
              <Input
                id="property-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Например: Сила, Здоровье"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                autoFocus
              />
            </div>

            {/* Категория */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-white">
                Категория *
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {PROPERTY_CATEGORIES.map((category) => (
                    <SelectItem 
                      key={category.value} 
                      value={category.value}
                      className="text-white hover:bg-gray-600"
                    >
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Тип свойства */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-white">
              Тип свойства *
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: PropertyTemplate['type']) => 
                setFormData(prev => ({ ...prev, type: value, defaultValue: '' }))
              }
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem 
                    key={type.value} 
                    value={type.value}
                    className="text-white hover:bg-gray-600"
                  >
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              Описание
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Описание свойства"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none h-20"
            />
          </div>

          {/* Настройки для числового типа */}
          {formData.type === 'number' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min" className="text-white">
                  Минимум
                </Label>
                <Input
                  id="min"
                  type="number"
                  value={formData.min}
                  onChange={(e) => setFormData(prev => ({ ...prev, min: Number(e.target.value) }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max" className="text-white">
                  Максимум
                </Label>
                <Input
                  id="max"
                  type="number"
                  value={formData.max}
                  onChange={(e) => setFormData(prev => ({ ...prev, max: Number(e.target.value) }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-number" className="text-white">
                  По умолчанию
                </Label>
                <Input
                  id="default-number"
                  type="number"
                  value={formData.defaultValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>
          )}

          {/* Настройки для текстового типа */}
          {formData.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="default-text" className="text-white">
                Значение по умолчанию
              </Label>
              <Input
                id="default-text"
                value={formData.defaultValue}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
                placeholder="Значение по умолчанию"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          )}

          {/* Настройки для булевого типа */}
          {formData.type === 'boolean' && (
            <div className="space-y-2">
              <Label htmlFor="default-boolean" className="text-white">
                Значение по умолчанию
              </Label>
              <Select
                value={formData.defaultValue}
                onValueChange={(value) => setFormData(prev => ({ ...prev, defaultValue: value }))}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Выберите значение" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="false" className="text-white hover:bg-gray-600">Нет</SelectItem>
                  <SelectItem value="true" className="text-white hover:bg-gray-600">Да</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Настройки для типа выбора */}
          {formData.type === 'select' && (
            <div className="space-y-3">
              <Label className="text-white">Варианты выбора</Label>
              {formData.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Вариант ${index + 1}`}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 flex-1"
                  />
                  {formData.options.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                + Добавить вариант
              </Button>
            </div>
          )}

          {/* Обязательное поле */}
          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={formData.required}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, required: checked }))}
            />
            <Label htmlFor="required" className="text-white">
              Обязательное поле
            </Label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!canSave}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isEditing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { PropertyTemplate, PropertyModalProps };
