"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Mail, Lock, Gamepad2, Users, Clock, MapPin, Plus, Settings, LogOut, Eye, Play } from "lucide-react"
import Link from "next/link"

const mockSessions = [
  {
    id: "session-1",
    name: "Эпическое приключение",
    description: "Путешествие через темные земли в поисках древнего артефакта",
    gamemaster: "DragonMaster",
    players: 4,
    maxPlayers: 6,
    status: "active",
    startTime: "19:00",
    duration: "3 часа",
    difficulty: "Средняя",
    tags: ["Фэнтези", "Приключения", "Ролевая"],
  },
  {
    id: "session-2",
    name: "Космическая одиссея",
    description: "Исследование неизвестных галактик и встреча с инопланетными цивилизациями",
    gamemaster: "StarCaptain",
    players: 2,
    maxPlayers: 5,
    status: "waiting",
    startTime: "20:30",
    duration: "4 часа",
    difficulty: "Высокая",
    tags: ["Sci-Fi", "Исследование", "Космос"],
  },
  {
    id: "session-3",
    name: "Детективное расследование",
    description: "Раскрытие загадочного убийства в викторианском Лондоне",
    gamemaster: "SherlockGM",
    players: 3,
    maxPlayers: 4,
    status: "full",
    startTime: "18:00",
    duration: "2 часа",
    difficulty: "Легкая",
    tags: ["Детектив", "Историческая", "Мистика"],
  },
]

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const handleLogin = () => {
    // Симуляция входа
    setCurrentUser({
      id: "user-1",
      username: "PlayerOne",
      email: loginForm.email,
      avatar: "/placeholder.svg?height=60&width=60",
      level: 15,
      sessionsPlayed: 23,
      favoriteGenre: "Фэнтези",
    })
    setIsLoggedIn(true)
  }

  const handleRegister = () => {
    // Симуляция регистрации
    setCurrentUser({
      id: "user-new",
      username: registerForm.username,
      email: registerForm.email,
      avatar: "/placeholder.svg?height=60&width=60",
      level: 1,
      sessionsPlayed: 0,
      favoriteGenre: "Новичок",
    })
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentUser(null)
    setLoginForm({ email: "", password: "" })
    setRegisterForm({ username: "", email: "", password: "", confirmPassword: "" })
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <Gamepad2 className="w-8 h-8" />
                RPG Sessions
              </CardTitle>
              <p className="text-gray-400">Добро пожаловать в мир приключений</p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-700">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="register">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <Button onClick={handleLogin} className="w-full">
                    Войти
                  </Button>
                </TabsContent>

                <TabsContent value="register" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Имя пользователя</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-username"
                        placeholder="Ваш ник"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Подтвердите пароль</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10 bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>

                  <Button onClick={handleRegister} className="w-full">
                    Зарегистрироваться
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Навигационная панель */}
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-8 h-8" />
            <h1 className="text-xl font-bold">RPG Sessions</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={currentUser.avatar || "/placeholder.svg"}
                alt={currentUser.username}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm">{currentUser.username}</span>
            </div>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 mb-6">
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Игровые сессии
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Профиль
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Доступные сессии</h2>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Создать сессию
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockSessions.map((session) => (
                <motion.div key={session.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300 h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <Badge
                          variant={
                            session.status === "active"
                              ? "default"
                              : session.status === "waiting"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {session.status === "active"
                            ? "Активна"
                            : session.status === "waiting"
                              ? "Ожидание"
                              : "Заполнена"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{session.description}</p>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Мастер: {session.gamemaster}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>
                            {session.players}/{session.maxPlayers} игроков
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{session.startTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4" />
                        <span>Сложность: {session.difficulty}</span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {session.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="w-4 h-4 mr-2" />
                          Подробнее
                        </Button>
                        <Link href={`/session/${session.id}`} className="flex-1">
                          <Button size="sm" className="w-full" disabled={session.status === "full"}>
                            <Play className="w-4 h-4 mr-2" />
                            {session.status === "full" ? "Заполнена" : "Присоединиться"}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Основная информация профиля */}
              <div className="lg:col-span-1">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="text-center">
                    <img
                      src={currentUser.avatar || "/placeholder.svg"}
                      alt={currentUser.username}
                      className="w-24 h-24 rounded-full mx-auto mb-4"
                    />
                    <CardTitle>{currentUser.username}</CardTitle>
                    <p className="text-gray-400">{currentUser.email}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Уровень:</span>
                      <span className="font-semibold">{currentUser.level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Сессий сыграно:</span>
                      <span className="font-semibold">{currentUser.sessionsPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Любимый жанр:</span>
                      <span className="font-semibold">{currentUser.favoriteGenre}</span>
                    </div>
                    <Button className="w-full mt-4">Редактировать профиль</Button>
                  </CardContent>
                </Card>
              </div>

              {/* Статистика и достижения */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Статистика</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">23</div>
                        <div className="text-sm text-gray-400">Сессий завершено</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">156</div>
                        <div className="text-sm text-gray-400">Часов в игре</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">8</div>
                        <div className="text-sm text-gray-400">Персонажей создано</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">4.8</div>
                        <div className="text-sm text-gray-400">Средний рейтинг</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Недавние сессии</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {[
                          { name: "Подземелья дракона", date: "2 дня назад", duration: "3ч 45м" },
                          { name: "Космическая станция", date: "5 дней назад", duration: "2ч 30м" },
                          { name: "Тайна старого замка", date: "1 неделя назад", duration: "4ч 15м" },
                        ].map((session, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                            <div>
                              <div className="font-medium">{session.name}</div>
                              <div className="text-sm text-gray-400">{session.date}</div>
                            </div>
                            <div className="text-sm text-gray-400">{session.duration}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
