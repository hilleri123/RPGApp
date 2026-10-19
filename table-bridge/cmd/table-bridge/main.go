package main

import (
	"context"
	"io"
	"log"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"table-bridge/internal/api"
	"table-bridge/internal/discover"
	"table-bridge/internal/jingle"
	"table-bridge/internal/media"
	"table-bridge/internal/xmpp"
)

type seat struct {
	cancel  context.CancelFunc
	audio   atomic.Pointer[api.Audio]
	music   atomic.Bool
	test    atomic.Bool
	auto    atomic.Bool
	heardMu sync.Mutex
	heard   map[string]api.Speaker
	nicks   map[string]string
	drop    []string
	cue     *media.OpenCue
}

// Часы всех строк: 19.10.2026 16:49:05+03. Смещение фиксированное, tzdata в образе не нужна.
var euClock = time.FixedZone("+03", 3*60*60)

type euWriter struct{ dst io.Writer }

func (w euWriter) Write(p []byte) (int, error) {
	stamp := time.Now().In(euClock).Format("02.01.2006 15:04:05+03 ")
	n, err := w.dst.Write([]byte(stamp))
	m, err2 := w.dst.Write(p)
	if err2 != nil {
		return n, err2
	}
	return n + m, err
}

func main() {
	log.SetFlags(0)
	log.SetOutput(euWriter{dst: os.Stderr})
	client := api.New()
	var mu sync.Mutex
	seats := map[string]*seat{}
	log.Printf("table-bridge ждёт столы у %s", client.Base)
	for {
		tables, err := client.Active()
		if err != nil {
			log.Printf("список столов: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}
		seen := map[string]bool{}
		mu.Lock()
		for _, table := range tables {
			seen[table.ID] = true
			current := seats[table.ID]
			if table.Status == "stopping" {
				if current != nil {
					current.cancel()
					delete(seats, table.ID)
				}
				continue
			}
			fresh := current == nil
			if fresh {
				current = &seat{cancel: func() {}}
				seats[table.ID] = current
			}
			current.music.Store(table.MusicEnabled)
			current.test.Store(table.TestRequested)
			current.auto.Store(table.AutoConnect)
			if table.Audio != nil {
				copy := *table.Audio
				current.audio.Store(&copy)
			} else {
				current.audio.Store(nil)
			}
			if fresh {
				ctx, cancel := context.WithCancel(context.Background())
				current.cancel = cancel
				go func(table api.Table, current *seat) {
					serve(ctx, client, table, current)
					mu.Lock()
					if seats[table.ID] == current {
						delete(seats, table.ID)
					}
					mu.Unlock()
				}(table, current)
			}
		}
		for id, current := range seats {
			if !seen[id] {
				current.cancel()
				delete(seats, id)
			}
		}
		mu.Unlock()
		time.Sleep(time.Second)
	}
}

func serve(ctx context.Context, client api.Client, table api.Table, current *seat) {
	phase := "joining"
	var gotJingle atomic.Bool
	fail := func(err error) {
		detail := err.Error()
		if strings.Contains(detail, "i/o timeout") || strings.Contains(detail, "TLS handshake timeout") {
			detail = "Переговорка не ответила вовремя"
		}
		log.Printf("стол %s: %v", table.ID, err)
		if current.test.Load() {
			_ = client.Report(table.ID, "Стол: ошибка входа, "+detail)
		}
		if current.auto.Load() && ctx.Err() == nil {
			_ = client.Status(table.ID, "joining", detail+", вхожу снова")
			time.Sleep(3 * time.Second)
			return
		}
		_ = client.Status(table.ID, "error", detail)
	}
	_ = client.Status(table.ID, "joining", "ищу комнату")
	cfg, err := discover.Discover(table.RoomURL)
	if err != nil {
		if ctx.Err() == nil {
			fail(err)
		}
		return
	}
	if ctx.Err() != nil {
		return
	}
	_ = client.Status(table.ID, "joining", cfg.Websocket)
	session, err := xmpp.Dial(cfg, table.Password)
	if err != nil {
		if ctx.Err() == nil {
			fail(err)
		}
		return
	}
	defer session.Leave()
	if ctx.Err() != nil {
		return
	}
	_ = session.SetMuted(!current.music.Load())
	book := media.NewBook()
	var closeMedia func()
	var uploaded atomic.Bool
	var appliedMute *bool
	var testSent bool
	pulse := time.NewTicker(time.Second)
	defer pulse.Stop()
	for {
		select {
		case <-pulse.C:
			wantMute := !current.music.Load()
			if appliedMute == nil || *appliedMute != wantMute {
				if err := session.SetMuted(wantMute); err != nil {
					log.Printf("микрофон: %v", err)
				} else {
					appliedMute = &wantMute
				}
			}
			if audio, err := client.Cursor(table.ID); err != nil {
				log.Printf("микшер: %v", err)
			} else if audio == nil {
				current.audio.Store(nil)
			} else {
				copy := *audio
				current.audio.Store(&copy)
			}
			if closed, next := media.Follow(current.cue, current.audio.Load(), time.Now()); closed != nil || next != current.cue {
				current.cue = next
				if closed != nil {
					if err := client.Music(table.ID, closed.Path, closed.Started, closed.Ended, closed.From, closed.To); err != nil {
						log.Printf("отрезок музыки: %v", err)
					}
				}
			}
			current.heardMu.Lock()
			speakers := make([]api.Speaker, 0, len(current.heard))
			for _, row := range current.heard {
				speakers = append(speakers, row)
			}
			drop := append([]string(nil), current.drop...)
			current.drop = nil
			current.heardMu.Unlock()
			if len(speakers) > 0 || len(drop) > 0 {
				if err := client.Heard(table.ID, speakers, drop); err != nil {
					log.Printf("запись: %v", err)
				}
			}
			if current.test.Load() {
				if !testSent && (phase == "live" || phase == "lobby") {
					text := connectionReport(cfg.Websocket, phase, current.music.Load(), gotJingle.Load())
					if err := session.Chat(text); err != nil {
						text = text + ". В чат не отправилось: " + err.Error()
					}
					if err := client.Report(table.ID, text); err != nil {
						log.Printf("отчёт теста: %v", err)
					}
					testSent = true
				}
			} else {
				testSent = false
			}
		case <-ctx.Done():
			session.Leave()
			if closed, _ := media.Follow(current.cue, nil, time.Now()); closed != nil {
				_ = client.Music(table.ID, closed.Path, closed.Started, closed.Ended, closed.From, closed.To)
			}
			if closeMedia != nil {
				closeMedia()
			}
			if uploaded.Load() {
				_ = client.Status(table.ID, "transcribing", "")
			} else {
				_ = client.Status(table.ID, "ready", "")
			}
			return
		case event, ok := <-session.Events:
			if !ok {
				fail(errString("соединение закрыто"))
				return
			}
			switch event.Kind {
			case "lobby":
				phase = "lobby"
				_ = client.Status(table.ID, "lobby", "модератор ещё не пустил")
			case "joined":
				phase = "live"
				_ = session.SetMuted(!current.music.Load())
				_ = client.Status(table.ID, "live", cfg.Room+"@"+cfg.MUC)
			case "sources":
				book.Merge(event.Data)
			case "occupant":
				if event.Data == "focus" || strings.HasSuffix(event.From, "/focus") {
					continue
				}
				rememberNick(current, event.From, event.Data)
				_ = client.Participant(table.ID, event.From, event.Data)
			case "jingle":
				if jingle.IsP2P(event.Data, event.From) {
					if err := session.Decline(event.Data, event.From); err != nil {
						log.Printf("отказ от прямого звонка: %v", err)
					}
					continue
				}
				gotJingle.Store(true)
				if err := session.Ack(event.Data, event.From); err != nil {
					log.Printf("подтверждение видеомоста: %v", err)
				}
				answer, ssrc, done, err := media.Answer(ctx, event.Data, event.From, &current.audio, book, client, func(jitsiID, name string, started, ended time.Time, file []byte) {
					name = knownNick(current, jitsiID, name)
					current.heardMu.Lock()
					delete(current.heard, jitsiID)
					current.heardMu.Unlock()
					if err := client.Segment(table.ID, jitsiID, name, started, ended, file); err != nil {
						log.Printf("сегмент: %v", err)
						return
					}
					uploaded.Store(true)
				}, func(jitsiID, name string, nbytes int64, seconds float64, replaced string) {
					name = knownNick(current, jitsiID, name)
					current.heardMu.Lock()
					if current.heard == nil {
						current.heard = map[string]api.Speaker{}
					}
					if replaced != "" {
						delete(current.heard, replaced)
						current.drop = append(current.drop, replaced)
					}
					if jitsiID != "" {
						current.heard[jitsiID] = api.Speaker{JitsiID: jitsiID, Name: name, Bytes: nbytes, Seconds: seconds}
					}
					current.heardMu.Unlock()
				})
				if err != nil {
					_ = client.Status(table.ID, "live", err.Error())
					continue
				}
				offer, err := jingle.ParseOffer(event.Data, event.From)
				if err != nil {
					done()
					log.Printf("разбор предложения видеомоста: %v", err)
					continue
				}
				if err := session.Accept(offer, answer, ssrc); err != nil {
					done()
					_ = client.Status(table.ID, "live", err.Error())
					continue
				}
				log.Printf("видеомост принят %s", offer.SID)
				closeMedia = done
			case "closed":
				fail(errString(event.Data))
				return
			}
		}
	}
}

func rememberNick(current *seat, jid, name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	resource := jid
	if i := strings.LastIndex(jid, "/"); i >= 0 {
		resource = jid[i+1:]
	}
	current.heardMu.Lock()
	defer current.heardMu.Unlock()
	if current.nicks == nil {
		current.nicks = map[string]string{}
	}
	current.nicks[jid] = name
	current.nicks[resource] = name
	for id, row := range current.heard {
		if row.JitsiID == jid || row.JitsiID == resource || strings.HasSuffix(row.JitsiID, "/"+resource) || row.Name == resource {
			row.Name = name
			current.heard[id] = row
		}
	}
}

func knownNick(current *seat, jitsiID, fallback string) string {
	current.heardMu.Lock()
	defer current.heardMu.Unlock()
	if current.nicks == nil {
		return fallback
	}
	if name := current.nicks[jitsiID]; name != "" {
		return name
	}
	if i := strings.LastIndex(jitsiID, "/"); i >= 0 {
		if name := current.nicks[jitsiID[i+1:]]; name != "" {
			return name
		}
	}
	if name := current.nicks[fallback]; name != "" {
		return name
	}
	return fallback
}

func connectionReport(websocket, phase string, music, media bool) string {
	where := "подключается"
	switch phase {
	case "live":
		where = "в комнате"
	case "lobby":
		where = "ждёт в лобби"
	}
	mic := "микрофон выключен"
	if music {
		mic = "микрофон включён"
	}
	jingle := "ответа Jingle ещё нет"
	if media {
		jingle = "Jingle есть"
	}
	return "Стол " + time.Now().Format("15:04:05") + ": " + websocket + ", " + where + ", " + mic + ", " + jingle
}

type errString string

func (e errString) Error() string { return string(e) }
