'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { User as UserType, RegisterRequest } from '@/app/services/types/auth';
import { useAuth } from '@/app/services/hooks/useAuth';

interface RegisterFormProps {
  onRegister: (user: UserType) => void;
  onSwitchToLogin?: () => void;
}

interface RegisterFormData extends RegisterRequest {
  confirmPassword: string;
}

export default function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [form, setForm] = useState<RegisterFormData>({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { state, logout, login, register } = useAuth();

  const validateForm = (): string | null => {
    if (!form.full_name.trim()) return 'Имя пользователя обязательно';
    if (form.full_name.length < 3) return 'Имя пользователя должно содержать минимум 3 символа';
    
    if (!form.email.trim()) return 'Email обязателен';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return 'Некорректный формат email';
    
    if (!form.password) return 'Пароль обязателен';
    if (form.password.length < 6) return 'Пароль должен содержать минимум 6 символов';
    
    if (form.password !== form.confirmPassword) return 'Пароли не совпадают';
    
    return null;
  };

  const getPasswordStrength = (password: string): string => {
    if (password.length < 6) return 'Слабый';
    if (password.length < 8) return 'Средний';
    if (password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) return 'Сильный';
    return 'Средний';
  };

  const getStrengthColor = (strength: string): string => {
    switch (strength) {
      case 'Слабый': return 'text-red-400';
      case 'Средний': return 'text-yellow-400';
      case 'Сильный': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password
      });
      onRegister(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <Card className="w-full max-w-md mx-auto bg-gray-800 border-gray-700">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center text-white">
          Регистрация
        </CardTitle>
        <p className="text-sm text-gray-400 text-center">
          Создайте аккаунт для начала игры
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white">
              Имя пользователя *
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="username"
                type="text"
                value={form.full_name}
                onChange={handleInputChange('full_name')}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                placeholder="Введите имя пользователя"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Email *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={handleInputChange('email')}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                placeholder="Введите email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">
              Пароль *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleInputChange('password')}
                className="pl-10 pr-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                placeholder="Введите пароль"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-300"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {form.password && (
              <div className="text-sm">
                <span className="text-gray-400">Сложность: </span>
                <span className={getStrengthColor(passwordStrength)}>
                  {passwordStrength}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white">
              Подтверждение пароля *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                className="pl-10 pr-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                placeholder="Повторите пароль"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-300"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              {form.confirmPassword && form.password === form.confirmPassword && (
                <CheckCircle className="absolute right-10 top-3 h-4 w-4 text-green-400" />
              )}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 rounded-md p-3">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Регистрация...
              </>
            ) : (
              'Зарегистрироваться'
            )}
          </Button>

          {onSwitchToLogin && (
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-blue-400 hover:text-blue-300 underline"
                  disabled={loading}
                >
                  Войти
                </button>
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
