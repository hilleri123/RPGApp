# Дефекты фронтенда (RPGWebMainClient)

Снимок на коммит `eb82b9c`. Формат описания — см. [README.md](README.md).

## Сводка

| ID | Severity | Кратко |
|----|----------|--------|
| [FE-01](#fe-01) | critical · исправлено | Middleware считает просроченный токен валидным |
| [FE-02](#fe-02) | critical | Циклический импорт модуля самого в себя |
| [FE-03](#fe-03) | high | Действия молча теряются при обрыве WebSocket |
| [FE-04](#fe-04) | high | `throw` до вызова остальных хуков нарушает правила хуков |
| [FE-05](#fe-05) | high | Нет guard-ов по ролям на страницах админа и мастера |
| [FE-06](#fe-06) | medium | `removeSession` объявлен, но никогда не вызывается |
| [FE-07](#fe-07) | medium | Ошибки API уходят только в консоль |
| [FE-08](#fe-08) | medium | Пустой экран без объяснения при отсутствии персонажа |
| [FE-09](#fe-09) | medium | Бесконечный спиннер без таймаута |
| [FE-10](#fe-10) | medium | Полный deep clone сессии на каждый `session_update` |
| [FE-11](#fe-11) | low | `JSON.stringify` в теле рендера `ActionModal` |
| [FE-12](#fe-12) | low | `BaseApiClient` игнорирует per-request `timeout` |
| [FE-13](#fe-13) | low | Нет индикации состояния WebSocket |
| [FE-14](#fe-14) | low | Ключи списков по индексу |

---

## Critical

### FE-01

**Middleware считает просроченный токен валидным**

**Где:** [middleware.ts:8-21](../RPGWebMainClient/middleware.ts)

```typescript
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp < Date.now() / 1000;
  } catch {
    return true;
  }
}
```

**Проблема.** Две независимые ошибки в семи строках.

Первая: JWT кодируется в **base64url** (`-` и `_` вместо `+` и `/`), а `atob` ожидает обычный base64. На payload-ах с этими символами `atob` бросает, срабатывает `catch`, токен объявляется просроченным — пользователя выкидывает на логин случайным образом, в зависимости от содержимого его токена. Это выглядит как «сайт иногда разлогинивает».

Вторая опаснее: если в payload нет `exp`, то `payload.exp` — `undefined`, а `undefined < number` даёт `false`. Функция сообщает, что токен **не просрочен**. Токен без срока жизни проходит middleware всегда.

**Решение.** Декодировать base64url корректно (заменить `-`/`_`, добавить padding) и явно проверять наличие `exp`:

```typescript
if (typeof payload.exp !== 'number') return true;
return payload.exp < Date.now() / 1000;
```

Отсутствие поля должно означать «невалиден», а не «валиден». Middleware в любом случае лишь оптимизация UX — источник истины по правам остаётся на бэкенде.

**Исправлено** (`5edcede`). Добавлена `decodeBase64Url`, которая заменяет `-`/`_` и добавляет padding перед `atob`; `exp` проверяется через `typeof payload?.exp !== 'number'`. Проверено на подобранном payload с символами base64url: старый декодер сообщал «просрочен» (то есть выкидывал пользователя на `/login`), новый корректно распознаёт живой токен. Автотеста нет — в `RPGWebMainClient` не настроен тест-раннер, см. `INF-06`.

---

### FE-02

**Циклический импорт модуля самого в себя**

**Где:** [useCommonSessionWebSocket.ts:3](../RPGWebMainClient/app/services/hooks/useCommonSessionWebSocket.ts)

```typescript
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
```

**Проблема.** Файл импортирует собственный экспорт — функция объявлена в нём же на строке 48. Сейчас это не падает только потому, что импортированный биндинг нигде не используется, а бандлер разрешает цикл в `undefined`. Любая попытка вызвать его внутри файла даст `undefined is not a function` в рантайме, а не при сборке.

Скорее всего, следствие автоимпорта в редакторе.

**Решение.** Удалить строку. Чтобы такое ловилось автоматически — включить `import/no-self-import` в ESLint.

---

## High

### FE-03

**Действия молча теряются при обрыве WebSocket**

**Где:** [SessionWebSocketProvider.tsx:105-113](../RPGWebMainClient/app/services/providers/SessionWebSocketProvider.tsx)

```typescript
const sendAction = useCallback(
  (action: SessionActionBase) => {
    const ws = socketRef.current;
    if (ws && connected && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    }
  },
  [connected]
);
```

**Проблема.** Если сокет не открыт, функция **ничего не делает и ничего не возвращает**. Вызывающий код не может отличить отправку от потери: нет ни исключения, ни результата, ни очереди на переотправку.

Для игрока это выглядит как проигнорированное нажатие. В сессии, где очередь ходов важна, потерянный `submit` посреди `perform_move` ломает ход и требует вмешательства мастера.

**Решение.** Минимум — возвращать `boolean` и показывать пользователю ошибку. Правильно — буфер исходящих сообщений с переотправкой после reconnect и идемпотентными идентификаторами действий, чтобы повтор не создал дубликат на бэкенде.

---

### FE-04

**`throw` до вызова остальных хуков нарушает правила хуков**

**Где:** [useSessionWebSocket.ts:72](../RPGWebMainClient/app/services/hooks/useSessionWebSocket.ts), [usePlayerSessionWebSocket.ts:39](../RPGWebMainClient/app/services/hooks/usePlayerSessionWebSocket.ts), [useLobbyWebSocket.ts:22-25](../RPGWebMainClient/app/services/hooks/useLobbyWebSocket.ts)

```typescript
const ctx = useContext(SessionSocketContext);
if (!ctx) throw new Error('SessionSocketContext not found: провайдер не обёрнут!');

const { connected, sendAction, sendRequest, pluginUI } = ctx;

const setLocationCheck = useCallback(/* ... */);
```

**Проблема.** Условный `throw` стоит **до** десятков `useCallback` и `useMemo` ниже. Количество вызванных хуков зависит от условия, что нарушает правила хуков React. Пока контекст всегда есть, всё работает; но если провайдер размонтируется раньше потребителя (навигация, hot reload, Suspense-граница), React упадёт с «rendered fewer hooks than expected» — сообщением, которое ничего не говорит о настоящей причине.

Отдельно: ошибка не ловится ErrorBoundary-ем с понятным текстом, так что пользователь увидит белый экран.

**Решение.** Вернуть безопасное значение по умолчанию вместо `throw`, либо вынести проверку в обёртку-компонент, чтобы хуки вызывались безусловно.

---

### FE-05

**Нет guard-ов по ролям на страницах админа и мастера**

**Где:** [master/applications/page.tsx](../RPGWebMainClient/app/master/applications/page.tsx) — нет ни `useAuth`, ни `RequireAuth`, ни проверки `can_be_master`; `app/access_groups/[id]/page.tsx` — нет проверки `is_admin`

Корректный образец в том же проекте — [access_groups/page.tsx:30](../RPGWebMainClient/app/access_groups/page.tsx):

```typescript
if (!state.user?.is_admin) {
```

**Проблема.** Проверка есть на списке групп доступа, но отсутствует на карточке группы и на всех страницах заявок мастера. Данные защищены бэкендом, так что утечки нет, — но пользователь по прямой ссылке попадает на страницу, которая просто не работает: запросы возвращают 403, экран пустой, объяснения нет. Вместо честного «нет доступа» — впечатление сломанного сайта.

**Решение.** Обернуть страницы в общий guard-компонент с параметром требуемой роли и единым экраном «нет доступа». Разрозненные ручные проверки в каждой странице неизбежно будут забываться.

---

## Medium

### FE-06

**`removeSession` объявлен, но никогда не вызывается**

**Где:** [sessions.ts:94](../RPGWebMainClient/app/services/stores/sessions.ts) (тип) и [sessions.ts:394](../RPGWebMainClient/app/services/stores/sessions.ts) (реализация)

**Проблема.** Поиск по всему `app/` даёт только эти два вхождения — вызовов нет. Сессии добавляются в стор и не удаляются никогда: ни при выходе из сессии, ни при её завершении. За долгую сессию с несколькими переходами в памяти накапливаются полные копии `GameSession` (см. `FE-10` — они ещё и глубоко клонированы).

**Решение.** Вызывать `removeSession` при размонтировании провайдера сессии и по приходу `session_finished`.

---

### FE-07

**Ошибки API уходят только в консоль**

**Где:** [LobbyList.tsx:35-36](../RPGWebMainClient/app/components/lobby/LobbyList.tsx)

```typescript
} catch (err) {
  console.error('API error:', err);
}
```

**Проблема.** Состояния ошибки нет, `lobbies` остаётся `[]`, и компонент рисует пустой список. «Лобби пока нет» и «бэкенд лежит» выглядят для пользователя одинаково. Пустого состояния тоже нет — просто ничего.

Это не единичный случай, а сквозной паттерн (см. [03-user-journeys.md](03-user-journeys.md#сквозная-проблема-обратная-связь-об-ошибках)).

**Решение.** Ввести состояние `error` в компонентах-списках, показывать сообщение с кнопкой «повторить», отдельно рисовать пустое состояние с подсказкой, что делать дальше.

---

### FE-08

**Пустой экран без объяснения при отсутствии персонажа**

**Где:** [PlayerView.tsx:42](../RPGWebMainClient/app/components/session/playerView/PlayerView.tsx)

```typescript
if (!selfPlayer?.character_id) return null;
```

**Проблема.** Игрок, вошедший в сессию до того, как мастер назначил ему персонажа, видит пустоту. `return null` — техническое решение, годное для необязательного виджета, но здесь это **основной экран роли**.

**Решение.** Вернуть экран ожидания: «Мастер ещё не назначил вам персонажа» плюс, если уместно, список доступных персонажей.

---

### FE-09

**Бесконечный спиннер без таймаута**

**Где:** [session/\[id\]/page.tsx:31-41](../RPGWebMainClient/app/session/[id]/page.tsx)

```typescript
if (!sessionData) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
}

if (isPlayer) return <SessionPlayerPage sessionId={sessionId} />;
if (isMaster) return <SessionMasterPage />;
return <div>У тебя нет роли</div>;
```

**Проблема.** Спиннер крутится, пока не придёт `session_init`. Если он не придёт никогда — сессия завершена, нет прав, сокет не поднялся — состояние вечное, без таймаута и без диагностики. Ветка «У тебя нет роли» ненамного лучше: это конечное состояние без объяснения и без выхода.

**Решение.** Таймаут (5-10 секунд) с переходом в экран ошибки и кнопкой переподключения. Разделить причины: сессия не найдена, нет доступа, потеряна связь. Ветке «нет роли» дать текст и ссылку на лобби.

---

### FE-10

**Полный deep clone сессии на каждый `session_update`**

**Где:** [sessions.ts:239](../RPGWebMainClient/app/services/stores/sessions.ts)

```typescript
const fullSessionCopy: GameSession = JSON.parse(JSON.stringify(sessionData));
```

**Проблема.** `JSON.parse(JSON.stringify(...))` — самый дорогой способ копирования, и он выполняется при **каждом** обновлении сессии. Объект `GameSession` содержит все локации, NPC, предметы, сцены и логи. В активной сессии обновления идут постоянно, и каждое клонирует мегабайты, нагружая сборщик мусора. Побочно теряются `Date` и `undefined`.

**Решение.** Иммутабельное обновление только изменённых полей — бэкенд уже присылает список изменённых полей в `session_update`, так что информация для точечного применения есть. Либо `structuredClone`, если полная копия действительно нужна.

---

## Low

### FE-11

**`JSON.stringify` в теле рендера `ActionModal`**

**Где:** [ActionModal.tsx:60](../RPGWebMainClient/app/components/session/common/feeds/actions/ActionModal.tsx)

```typescript
const serverDraftKey = JSON.stringify(readActionDraft(action, viewKey));
```

**Проблема.** Сериализация на каждый рендер модалки, чтобы получить ключ для сравнения. Приём рабочий, но на крупных черновиках действий он выполняется чаще необходимого.

**Решение.** Обернуть в `useMemo` с зависимостями от `action` и `viewKey`.

---

### FE-12

**`BaseApiClient` игнорирует per-request `timeout`**

**Где:** [base.ts:46](../RPGWebMainClient/app/services/api/base.ts) и [base.ts:82](../RPGWebMainClient/app/services/api/base.ts)

```typescript
const { timeout = this.defaultTimeout, retries = this.defaultRetries, ... } = config;
```

```typescript
const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
```

**Проблема.** `timeout` из конфига запроса извлекается и никуда не передаётся: `executeWithRetry` использует `this.defaultTimeout`. Публичный параметр `timeout` в `RequestConfig` (строка 26) не работает. Загрузка большого файла, которой нужен увеличенный таймаут, оборвётся по общему значению.

**Решение.** Передать `timeout` в `executeWithRetry` параметром.

---

### FE-13

**Нет индикации состояния WebSocket**

**Проблема.** Провайдер хранит `connected`, но в интерфейсе сессии это состояние нигде не показано. Вместе с `FE-03` (тихая потеря действий) получается худший вариант: связь потеряна, действия не уходят, и об этом ничего не сообщается.

**Решение.** Индикатор соединения в шапке сессии и баннер «соединение потеряно, переподключаемся» при разрыве.

---

### FE-14

**Ключи списков по индексу**

**Проблема.** Четыре места в `app/**/*.tsx` используют `key={index}` / `key={i}`. Для статических списков это безвредно, но при вставке или удалении элемента React переиспользует не те узлы, что даёт визуальные артефакты и потерю состояния полей ввода.

**Решение.** Использовать стабильные `id` сущностей — они есть у всех доменных объектов.
