"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Gamepad2,
  Palette,
  Rocket,
  MapPin,
  Sword,
  Shield,
  Gem,
  Crown,
  Paintbrush,
  Camera,
  X,
  Maximize2,
  Clock,
  Users,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

// Карты (отдельно от сцен)
const maps = [
  {
    id: "arena-map",
    title: "Арена сражений",
    image: "/placeholder.svg?height=300&width=400",
    description: "Классическая арена для PvP боев",
  },
  {
    id: "forest-map",
    title: "Темный лес",
    image: "/placeholder.svg?height=300&width=400",
    description: "Мистический лес с древними тайнами",
  },
  {
    id: "castle-map",
    title: "Замок короля",
    image: "/placeholder.svg?height=300&width=400",
    description: "Величественный замок на вершине горы",
  },
]

// Доступные элементы для перетаскивания
const availableElements = [
  {
    id: "sword",
    icon: Sword,
    name: "Меч героя",
    description: "Легендарный клинок, способный разрубить любую броню",
    actions: ["Взять", "Изучить", "Улучшить"],
    category: "weapon",
  },
  {
    id: "shield",
    icon: Shield,
    name: "Щит защитника",
    description: "Магический щит, отражающий заклинания врагов",
    actions: ["Экипировать", "Зачаровать"],
    category: "armor",
  },
  {
    id: "gem",
    icon: Gem,
    name: "Кристалл силы",
    description: "Редкий кристалл, увеличивающий магическую мощь",
    actions: ["Собрать", "Активировать"],
    category: "magic",
  },
  {
    id: "crown",
    icon: Crown,
    name: "Корона чемпиона",
    description: "Награда для победителя турнира",
    actions: ["Надеть", "Показать"],
    category: "treasure",
  },
  {
    id: "brush",
    icon: Paintbrush,
    name: "Кисть мастера",
    description: "Волшебная кисть, оживляющая любые рисунки",
    actions: ["Взять", "Рисовать", "Очистить"],
    category: "tool",
  },
  {
    id: "camera",
    icon: Camera,
    name: "Камера времени",
    description: "Фотоаппарат, запечатлевающий моменты вдохновения",
    actions: ["Сфотографировать", "Настроить"],
    category: "tool",
  },
]

const itemTypes = [
  {
    id: "weapon",
    name: "Оружие",
    color: "from-red-500 to-orange-500",
    defaultIcon: Sword,
    fields: ["damage", "durability", "rarity"],
  },
  {
    id: "tool",
    name: "Инструмент",
    color: "from-blue-500 to-cyan-500",
    defaultIcon: Paintbrush,
    fields: ["efficiency", "uses", "material"],
  },
  {
    id: "magic",
    name: "Магический предмет",
    color: "from-purple-500 to-pink-500",
    defaultIcon: Gem,
    fields: ["mana_cost", "spell_power", "element"],
  },
]

const iconOptions = [
  { name: "Меч", icon: Sword },
  { name: "Щит", icon: Shield },
  { name: "Кристалл", icon: Gem },
  { name: "Корона", icon: Crown },
  { name: "Кисть", icon: Paintbrush },
  { name: "Камера", icon: Camera },
]

// Сцены (теперь отдельно от карт)
const initialScenes = [
  {
    id: "gaming-scene",
    title: "Игровая арена",
    icon: Gamepad2,
    color: "from-purple-500 to-pink-500",
    description: "Эпическая арена для сражений героев",
    elements: [],
  },
  {
    id: "creative-scene",
    title: "Творческая мастерская",
    icon: Palette,
    color: "from-blue-500 to-cyan-500",
    description: "Уютная мастерская художника",
    elements: [],
  },
  {
    id: "space-scene",
    title: "Космическая станция",
    icon: Rocket,
    color: "from-indigo-500 to-purple-500",
    description: "Орбитальная станция в далеком космосе",
    elements: [],
  },
]

export default function Component() {
  const [currentMap, setCurrentMap] = useState(0)
  const [scenes, setScenes] = useState(initialScenes)
  const [selectedElement, setSelectedElement] = useState<any>(null)
  const [fullscreenScene, setFullscreenScene] = useState<any>(null)
  const [actionLog, setActionLog] = useState<string[]>([
    "Система запущена",
    "Загружены карты и сцены",
    "Готов к работе",
  ])
  const [draggedElement, setDraggedElement] = useState<any>(null)

  const [availableElementsList, setAvailableElementsList] = useState(availableElements)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    type: "",
    icon: "Sword",
    actions: [""],
    customFields: {} as Record<string, string>,
  })

  const [showPlayersPanel, setShowPlayersPanel] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null)
  const [connectedPlayers] = useState([
    {
      id: "player1",
      nickname: "DragonSlayer",
      status: "online",
      character: {
        name: "Артур Светлый",
        level: 25,
        class: "Паладин",
        avatar: "/placeholder.svg?height=60&width=60",
      },
      lastSeen: "Сейчас в игре",
    },
    {
      id: "player2",
      nickname: "MysticMage",
      status: "away",
      character: {
        name: "Элара Звездная",
        level: 18,
        class: "Маг",
        avatar: "/placeholder.svg?height=60&width=60",
      },
      lastSeen: "5 минут назад",
    },
    {
      id: "player3",
      nickname: "ShadowRogue",
      status: "offline",
      character: {
        name: "Кай Тенебрис",
        level: 22,
        class: "Разбойник",
        avatar: "/placeholder.svg?height=60&width=60",
      },
      lastSeen: "2 часа назад",
    },
  ])

  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setActionLog((prev) => [`[${timestamp}] ${message}`, ...prev])
  }

  const handleDragStart = (e: React.DragEvent, element: any) => {
    setDraggedElement(element)
    e.dataTransfer.effectAllowed = "copy"
    addToLog(`Начато перетаскивание: ${element.name}`)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const handleDrop = (e: React.DragEvent, sceneId: string) => {
    e.preventDefault()
    if (draggedElement) {
      setScenes((prev) =>
        prev.map((scene) => {
          if (scene.id === sceneId) {
            const elementExists = scene.elements.some((el: any) => el.id === draggedElement.id)
            if (!elementExists) {
              addToLog(`Элемент "${draggedElement.name}" добавлен в сцену "${scene.title}"`)
              return {
                ...scene,
                elements: [...scene.elements, { ...draggedElement, addedAt: Date.now() }],
              }
            } else {
              addToLog(`Элемент "${draggedElement.name}" уже существует в сцене "${scene.title}"`)
            }
          }
          return scene
        }),
      )
      setDraggedElement(null)
    }
  }

  const removeElementFromScene = (sceneId: string, elementId: string) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id === sceneId) {
          const element = scene.elements.find((el: any) => el.id === elementId)
          if (element) {
            addToLog(`Элемент "${element.name}" удален из сцены "${scene.title}"`)
          }
          return {
            ...scene,
            elements: scene.elements.filter((el: any) => el.id !== elementId),
          }
        }
        return scene
      }),
    )
  }

  const openFullscreenScene = (scene: any) => {
    setFullscreenScene(scene)
    addToLog(`Открыта полноэкранная сцена: ${scene.title}`)
  }

  const addNewItem = () => {
    if (!newItem.name || !newItem.description || !newItem.type) {
      addToLog("Ошибка: заполните все обязательные поля")
      return
    }

    const selectedIcon = iconOptions.find((opt) => opt.name === newItem.icon)?.icon || Sword
    const selectedType = itemTypes.find((t) => t.id === newItem.type)

    const newElement = {
      id: `custom-${Date.now()}`,
      icon: selectedIcon,
      name: newItem.name,
      description: newItem.description,
      actions: newItem.actions.filter((action) => action.trim() !== ""),
      category: newItem.type,
      customFields: newItem.customFields,
      isCustom: true,
    }

    setAvailableElementsList((prev) => [...prev, newElement])
    addToLog(`Создан новый предмет: ${newItem.name} (${selectedType?.name})`)

    // Сброс формы
    setNewItem({
      name: "",
      description: "",
      type: "",
      icon: "Sword",
      actions: [""],
      customFields: {},
    })
    setShowAddForm(false)
  }

  const updateAction = (index: number, value: string) => {
    const newActions = [...newItem.actions]
    newActions[index] = value
    setNewItem((prev) => ({ ...prev, actions: newActions }))
  }

  const addAction = () => {
    setNewItem((prev) => ({ ...prev, actions: [...prev.actions, ""] }))
  }

  const removeAction = (index: number) => {
    setNewItem((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }))
  }

  const updateCustomField = (field: string, value: string) => {
    setNewItem((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [field]: value },
    }))
  }

  const deleteCustomItem = (itemId: string) => {
    setAvailableElementsList((prev) => prev.filter((item) => item.id !== itemId))
    addToLog("Пользовательский предмет удален")
  }

  const openCharacterDetails = (player: any) => {
    setSelectedCharacter(player)
    addToLog(`Открыта карточка персонажа: ${player.character.name}`)
  }

  const map = maps[currentMap]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Основной интерфейс */}
      <div className="flex h-screen pb-20">
        {/* Левая панель - Карты */}
        <div className="w-1/3 p-6 border-r border-gray-700 flex flex-col">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Текущая карта
          </h2>

          {/* Текущая карта */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden mb-6">
            <img src={map.image || "/placeholder.svg"} alt={map.title} className="w-full h-64 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <h3 className="font-bold text-white">{map.title}</h3>
              <p className="text-gray-300 text-sm">{map.description}</p>
            </div>
          </div>

          {/* Список карт */}
          <h3 className="text-lg font-semibold mb-3">Доступные карты</h3>
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {maps.map((mapItem, index) => (
                <Card
                  key={mapItem.id}
                  className={`cursor-pointer transition-all duration-300 ${
                    currentMap === index
                      ? "bg-blue-600 border-blue-500"
                      : "bg-gray-800 border-gray-700 hover:bg-gray-750"
                  }`}
                  onClick={() => {
                    setCurrentMap(index)
                    addToLog(`Выбрана карта: ${mapItem.title}`)
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={mapItem.image || "/placeholder.svg"}
                        alt={mapItem.title}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div>
                        <h4 className="font-semibold text-sm">{mapItem.title}</h4>
                        <p className="text-xs text-gray-400">{mapItem.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Центральная панель - Элементы */}
        <div className="flex-1 p-6">
          <h2 className="text-xl font-bold mb-4">Доступные элементы</h2>
          <p className="text-gray-400 mb-6">Перетащите элементы в сцены для их добавления</p>

          <div className="grid grid-cols-2 gap-4">
            {availableElementsList.map((element) => {
              const IconComponent = element.icon
              return (
                <motion.div
                  key={element.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative"
                >
                  <Card
                    className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300 cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleDragStart(e, element)}
                    onClick={() => setSelectedElement(element)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500">
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{element.name}</h3>
                          <p className="text-sm text-gray-400">Перетащите в сцену</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {element.isCustom && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCustomItem(element.id)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Правая панель - Сцены */}
        <div className="w-1/3 p-6 border-l border-gray-700 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Сцены</h2>

          <ScrollArea className="flex-1 mb-4">
            <div className="space-y-3">
              {scenes.map((scene) => {
                const IconComponent = scene.icon
                return (
                  <motion.div key={scene.id} whileHover={{ scale: 1.02 }} className="relative">
                    <Card
                      className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, scene.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-5 h-5" />
                            <h3 className="font-semibold">{scene.title}</h3>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => openFullscreenScene(scene)}>
                            <Maximize2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className={`h-16 rounded bg-gradient-to-r ${scene.color} opacity-60 mb-3`} />

                        <p className="text-xs text-gray-400 mb-3">{scene.elements.length} элементов</p>

                        {/* Элементы в сцене */}
                        {scene.elements.length > 0 && (
                          <div className="space-y-1">
                            {scene.elements.slice(0, 3).map((element: any) => {
                              const IconComponent = element.icon
                              return (
                                <div
                                  key={`${scene.id}-${element.id}`}
                                  className="flex items-center justify-between text-xs bg-gray-700 rounded p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="w-3 h-3" />
                                    <span>{element.name}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-4 w-4 p-0"
                                    onClick={() => removeElementFromScene(scene.id, element.id)}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              )
                            })}
                            {scene.elements.length > 3 && (
                              <p className="text-xs text-gray-500">+{scene.elements.length - 3} еще...</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>

          {/* Лог действий */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Лог действий
            </h3>
            <ScrollArea className="h-32 bg-gray-800 rounded p-3">
              <div className="space-y-1">
                {actionLog.map((log, index) => (
                  <p key={index} className="text-xs text-gray-300 font-mono">
                    {log}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Панель игроков */}
      <AnimatePresence>
        {showPlayersPanel && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-gray-800 border-r border-gray-700 z-40 flex flex-col"
          >
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Подключенные игроки
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setShowPlayersPanel(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {connectedPlayers.filter((p) => p.status === "online").length} из {connectedPlayers.length} онлайн
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {connectedPlayers.map((player) => (
                  <motion.div key={player.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      className="bg-gray-900 border-gray-600 hover:bg-gray-750 transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        addToLog(`Просмотр персонажа: ${player.character.name} (${player.nickname})`)
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative">
                            <img
                              src={player.character.avatar || "/placeholder.svg"}
                              alt={player.character.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            <div
                              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
                                player.status === "online"
                                  ? "bg-green-500"
                                  : player.status === "away"
                                    ? "bg-yellow-500"
                                    : "bg-gray-500"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{player.nickname}</h3>
                            <p className="text-xs text-gray-400">{player.lastSeen}</p>
                          </div>
                        </div>

                        <div className="bg-gray-800 rounded p-3">
                          <h4 className="font-medium text-sm mb-2">{player.character.name}</h4>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>{player.character.class}</span>
                            <span>Ур. {player.character.level}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex justify-center">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              player.status === "online"
                                ? "bg-green-600"
                                : player.status === "away"
                                  ? "bg-yellow-600"
                                  : "bg-gray-600"
                            }`}
                          >
                            {player.status === "online" ? "В сети" : player.status === "away" ? "Отошел" : "Не в сети"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Панель сессии */}
      <AnimatePresence>
        {showSessionPanel && (
          <motion.div
            initial={{ y: 400, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-20 left-4 right-4 h-96 bg-gray-800 border border-gray-700 rounded-lg z-40 flex flex-col"
          >
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  Игровая сессия
                </h2>
                <Button size="sm" variant="ghost" onClick={() => setShowSessionPanel(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Активная сессия • {connectedPlayers.filter((p) => p.status === "online").length} игроков онлайн
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectedPlayers.map((player) => (
                  <motion.div key={player.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card className="bg-gray-900 border-gray-600 hover:bg-gray-750 transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative">
                            <img
                              src={player.character.avatar || "/placeholder.svg"}
                              alt={player.character.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            <div
                              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
                                player.status === "online"
                                  ? "bg-green-500"
                                  : player.status === "away"
                                    ? "bg-yellow-500"
                                    : "bg-gray-500"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{player.nickname}</h3>
                            <p className="text-xs text-gray-400">{player.lastSeen}</p>
                          </div>
                        </div>

                        <Card
                          className="bg-gray-800 border-gray-600 hover:bg-gray-700 transition-colors cursor-pointer"
                          onClick={() => openCharacterDetails(player)}
                        >
                          <CardContent className="p-3">
                            <h4 className="font-medium text-sm mb-2">{player.character.name}</h4>
                            <div className="flex justify-between text-xs text-gray-400 mb-2">
                              <span>{player.character.class}</span>
                              <span>Ур. {player.character.level}</span>
                            </div>
                            <div className="text-xs text-blue-400 hover:text-blue-300">Нажмите для просмотра</div>
                          </CardContent>
                        </Card>

                        <div className="mt-2 flex justify-center">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              player.status === "online"
                                ? "bg-green-600"
                                : player.status === "away"
                                  ? "bg-yellow-600"
                                  : "bg-gray-600"
                            }`}
                          >
                            {player.status === "online" ? "В сети" : player.status === "away" ? "Отошел" : "Не в сети"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Полноэкранная сцена */}
      <AnimatePresence>
        {fullscreenScene && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900 z-50 flex flex-col"
          >
            {/* Заголовок полноэкранной сцены */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <fullscreenScene.icon className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">{fullscreenScene.title}</h1>
                  <p className="text-gray-400">{fullscreenScene.description}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setFullscreenScene(null)
                  addToLog(`Закрыта полноэкранная сцена: ${fullscreenScene.title}`)
                }}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {/* Содержимое полноэкранной сцены */}
            <div className="flex-1 p-6">
              <div className={`h-64 rounded-lg bg-gradient-to-r ${fullscreenScene.color} opacity-20 mb-6`} />

              <h2 className="text-xl font-bold mb-4">Элементы в сцене</h2>

              {fullscreenScene.elements.length === 0 ? (
                <p className="text-gray-400">В этой сцене пока нет элементов</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {fullscreenScene.elements.map((element: any) => {
                    const IconComponent = element.icon
                    return (
                      <Card key={`fullscreen-${element.id}`} className="bg-gray-800 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${fullscreenScene.color}`}>
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-semibold">{element.name}</h3>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">{element.description}</p>
                          <div className="flex gap-2 flex-wrap">
                            {element.actions.map((action: string) => (
                              <Badge
                                key={action}
                                variant="secondary"
                                className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                onClick={() => addToLog(`Выполнено действие "${action}" с элементом "${element.name}"`)}
                              >
                                {action}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно для выбранного элемента */}
      <AnimatePresence>
        {selectedElement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
            onClick={() => setSelectedElement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <selectedElement.icon className="w-6 h-6" />
                <h3 className="text-xl font-bold">{selectedElement.name}</h3>
              </div>
              <p className="text-gray-300 mb-4">{selectedElement.description}</p>
              <div className="flex gap-2 flex-wrap mb-4">
                {selectedElement.actions.map((action: string) => (
                  <Button key={action} variant="outline" size="sm">
                    {action}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setSelectedElement(null)} className="w-full">
                Закрыть
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно персонажа */}
      <AnimatePresence>
        {selectedCharacter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSelectedCharacter(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-lg mx-4 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Карточка персонажа</h2>
                <Button variant="ghost" onClick={() => setSelectedCharacter(null)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Основная информация */}
                <div className="flex items-center gap-4">
                  <img
                    src={selectedCharacter.character.avatar || "/placeholder.svg"}
                    alt={selectedCharacter.character.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedCharacter.character.name}</h3>
                    <p className="text-gray-400">Игрок: {selectedCharacter.nickname}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{selectedCharacter.character.class}</Badge>
                      <Badge variant="outline">Уровень {selectedCharacter.character.level}</Badge>
                    </div>
                  </div>
                </div>

                {/* Статус */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Статус подключения</h4>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        selectedCharacter.status === "online"
                          ? "bg-green-500"
                          : selectedCharacter.status === "away"
                            ? "bg-yellow-500"
                            : "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm">
                      {selectedCharacter.status === "online"
                        ? "В сети"
                        : selectedCharacter.status === "away"
                          ? "Отошел"
                          : "Не в сети"}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">{selectedCharacter.lastSeen}</span>
                  </div>
                </div>

                {/* Характеристики персонажа */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Характеристики</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Здоровье</p>
                      <div className="bg-gray-700 rounded-full h-2 mt-1">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: "85%" }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">85/100</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Мана</p>
                      <div className="bg-gray-700 rounded-full h-2 mt-1">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: "60%" }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">60/100</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Опыт</p>
                      <div className="bg-gray-700 rounded-full h-2 mt-1">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: "75%" }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">750/1000</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Выносливость</p>
                      <div className="bg-gray-700 rounded-full h-2 mt-1">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: "90%" }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">90/100</p>
                    </div>
                  </div>
                </div>

                {/* Действия */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => addToLog(`Отправлено сообщение игроку ${selectedCharacter.nickname}`)}
                  >
                    Написать сообщение
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => addToLog(`Приглашение в группу отправлено ${selectedCharacter.nickname}`)}
                  >
                    Пригласить в группу
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Форма добавления предметов */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowPlayersPanel(!showPlayersPanel)}
                variant={showPlayersPanel ? "secondary" : "outline"}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Игроки ({connectedPlayers.filter((p) => p.status === "online").length})
              </Button>
              <Button
                onClick={() => setShowSessionPanel(!showSessionPanel)}
                variant={showSessionPanel ? "secondary" : "outline"}
                className="flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4" />
                Сессия
              </Button>
              <h3 className="text-lg font-semibold">Создание предметов</h3>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} variant={showAddForm ? "secondary" : "default"}>
              <Plus className="w-4 h-4 mr-2" />
              {showAddForm ? "Скрыть форму" : "Добавить предмет"}
            </Button>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="bg-gray-900 border-gray-600">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Основная информация */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-blue-400">Основная информация</h4>

                        <div>
                          <Label htmlFor="item-name">Название *</Label>
                          <Input
                            id="item-name"
                            value={newItem.name}
                            onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Введите название предмета"
                            className="bg-gray-800 border-gray-600"
                          />
                        </div>

                        <div>
                          <Label htmlFor="item-description">Описание *</Label>
                          <Textarea
                            id="item-description"
                            value={newItem.description}
                            onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Опишите предмет"
                            className="bg-gray-800 border-gray-600 h-20"
                          />
                        </div>

                        <div>
                          <Label htmlFor="item-type">Тип предмета *</Label>
                          <Select
                            value={newItem.type}
                            onValueChange={(value) => setNewItem((prev) => ({ ...prev, type: value }))}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-600">
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                            <SelectContent>
                              {itemTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded bg-gradient-to-r ${type.color}`} />
                                    {type.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="item-icon">Иконка</Label>
                          <Select
                            value={newItem.icon}
                            onValueChange={(value) => setNewItem((prev) => ({ ...prev, icon: value }))}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-600">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {iconOptions.map((option) => {
                                const IconComponent = option.icon
                                return (
                                  <SelectItem key={option.name} value={option.name}>
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="w-4 h-4" />
                                      {option.name}
                                    </div>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Действия */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-green-400">Действия</h4>

                        {newItem.actions.map((action, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={action}
                              onChange={(e) => updateAction(index, e.target.value)}
                              placeholder={`Действие ${index + 1}`}
                              className="bg-gray-800 border-gray-600"
                            />
                            {newItem.actions.length > 1 && (
                              <Button size="sm" variant="ghost" onClick={() => removeAction(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}

                        <Button size="sm" variant="outline" onClick={addAction} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Добавить действие
                        </Button>
                      </div>

                      {/* Специальные поля по типу */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-purple-400">Характеристики</h4>

                        {newItem.type &&
                          itemTypes
                            .find((t) => t.id === newItem.type)
                            ?.fields.map((field) => (
                              <div key={field}>
                                <Label htmlFor={`field-${field}`}>
                                  {field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ")}
                                </Label>
                                <Input
                                  id={`field-${field}`}
                                  value={newItem.customFields[field] || ""}
                                  onChange={(e) => updateCustomField(field, e.target.value)}
                                  placeholder={`Введите ${field.replace("_", " ")}`}
                                  className="bg-gray-gray-800 border-gray-600"
                                />
                              </div>
                            ))}

                        {newItem.type && (
                          <div className="pt-4">
                            <div
                              className={`p-3 rounded-lg bg-gradient-to-r ${itemTypes.find((t) => t.id === newItem.type)?.color} opacity-20`}
                            >
                              <p className="text-sm text-center">
                                Предварительный просмотр типа: {itemTypes.find((t) => t.id === newItem.type)?.name}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 mt-6 pt-4 border-t border-gray-600">
                      <Button onClick={addNewItem} className="flex-1">
                        <Plus className="w-4 h-4 mr-2" />
                        Создать предмет
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                        Отмена
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
