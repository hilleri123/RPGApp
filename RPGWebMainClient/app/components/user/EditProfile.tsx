import { useState, useEffect } from "react";
import { userApiService } from "@/app/services/api/users";
import { User, UserUpdate } from "@/app/services/types/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";

interface EditProfileProps {
  user: User;
  onUpdated: (user: UserUpdate) => void;
}

export default function EditProfile({ 
  user, 
  onUpdated 
}: EditProfileProps) {
  const [form, setForm] = useState<UserUpdate>({
    id: user.id,
    full_name: user.full_name ?? "",
    email: user.email ?? "",
    is_active: user.is_active,
    is_admin: user.is_admin,
    created_at: user.created_at,
    can_be_master: user.can_be_master,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await userApiService.adminUpdateUser(user.id, form);
      setSuccess(true);
      onUpdated(updated);
    } catch {
      // Добавить обработку ошибки, если нужно
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 p-3 rounded bg-gray-900 mb-2">
      <div className="input-black">
        <label className="block text-sm text-gray-400 mb-1">ID</label>
        <Input value={user.id} readOnly disabled className="bg-gray-800 text-gray-400" />
      </div>
      <div className="input-black">
        <label className="block text-sm font-semibold mb-1">Имя {user.telegram_id}</label>
        <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Email</label>
        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div className="input-black">
        <label className="block text-sm font-semibold mr-2">Может быть мастером</label>
        <input type="checkbox" checked={form.can_be_master}
          onChange={e => setForm(f => ({ ...f, can_be_master: e.target.checked }))} />
        <span className="ml-2 text-sm">{form.can_be_master ? "Да" : "Нет"}</span>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Pencil className="inline mr-1" />Сохранить</>}
      </Button>
      {success && <span className="ml-2 text-green-500">Сохранено!</span>}
    </form>
  );
}
