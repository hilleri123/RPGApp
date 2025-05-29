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
import { Skill, SkillGroup } from '@/app/rules/types'


interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skillData: {
    id?: string;
    name: string;
    description: string;
    groupId: string;
  }) => void;
  skill?: Skill | null;
  groupId?: string;
  skillGroups: SkillGroup[];
}

export default function SkillModal({
  isOpen,
  onClose,
  onSave,
  skill,
  groupId,
  skillGroups
}: SkillModalProps) {
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    groupId: groupId || ''
  });

  // Обновляем форму при изменении skill
  React.useEffect(() => {
    if (skill) {
      setFormData({
        name: skill.name,
        description: skill.description,
        groupId: groupId || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        groupId: groupId || ''
      });
    }
  }, [skill, groupId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.groupId) {
      return;
    }

    onSave({
      ...(skill && { id: skill.id }),
      name: formData.name.trim(),
      description: formData.description.trim(),
      groupId: formData.groupId
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      groupId: groupId || ''
    });
    onClose();
  };

  const isEditing = !!skill;
  const canSave = formData.name.trim() && formData.groupId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {isEditing ? 'Редактировать навык' : 'Добавить навык'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Выбор группы (только для нового навыка) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="group" className="text-white">
                Группа навыков *
              </Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, groupId: value }))}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Выберите группу навыков" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {skillGroups.map((group) => (
                    <SelectItem 
                      key={group.id} 
                      value={group.id}
                      className="text-white hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${group.color}`} />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Название навыка */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Название навыка *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Введите название навыка"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              autoFocus
            />
          </div>

          {/* Описание навыка */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              Описание
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Описание навыка (необязательно)"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none h-24"
            />
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

// Экспорт типов для использования в других компонентах
export type { Skill, SkillGroup, SkillModalProps };
