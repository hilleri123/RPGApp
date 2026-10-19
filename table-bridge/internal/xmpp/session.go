package xmpp

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"

	"table-bridge/internal/discover"
	"table-bridge/internal/jingle"
)

type Event struct {
	Kind string
	Data string
	From string
}

type Session struct {
	cfg      discover.Config
	nick     string
	password string
	conn     *websocket.Conn
	sendMu   sync.Mutex
	leave    sync.Once
	Events   chan Event
	JID      string
	muted    atomic.Bool
}

func Dial(cfg discover.Config, password string) (*Session, error) {
	header := http.Header{}
	header.Set("Sec-WebSocket-Protocol", "xmpp")
	endpoint := cfg.Websocket
	if cfg.Token != "" {
		sep := "?"
		if strings.Contains(endpoint, "?") {
			sep = "&"
		}
		endpoint += sep + "token=" + url.QueryEscape(cfg.Token)
	}
	log.Printf("переговорка → соединение %s", publicEndpoint(endpoint))
	conn, _, err := websocket.DefaultDialer.Dial(endpoint, header)
	if err != nil {
		log.Printf("переговорка ← соединение %s: %v", publicEndpoint(endpoint), err)
		return nil, err
	}
	log.Printf("переговорка ← соединение %s открыто", publicEndpoint(endpoint))
	session := &Session{
		cfg:      cfg,
		nick:     "Стол",
		password: password,
		conn:     conn,
		Events:   make(chan Event, 32),
	}
	session.muted.Store(true)
	if err := session.send(fmt.Sprintf(
		`<open xmlns='urn:ietf:params:xml:ns:xmpp-framing' to='%s' version='1.0'/>`,
		cfg.Domain,
	)); err != nil {
		conn.Close()
		return nil, err
	}
	go session.read()
	return session, nil
}

func (s *Session) send(xml string) error {
	log.Printf("переговорка → %s, %d байт", stanzaName(xml), len(xml))
	s.sendMu.Lock()
	defer s.sendMu.Unlock()
	err := s.conn.WriteMessage(websocket.TextMessage, []byte(xml))
	if err != nil {
		log.Printf("переговорка → %s не ушло: %v", stanzaName(xml), err)
	}
	return err
}

func (s *Session) read() {
	defer close(s.Events)
	for {
		_, raw, err := s.conn.ReadMessage()
		if err != nil {
			log.Printf("переговорка ← обрыв: %v", err)
			s.Events <- Event{Kind: "closed", Data: err.Error()}
			return
		}
		xml := string(raw)
		log.Printf("переговорка ← %s, %d байт", stanzaName(xml), len(raw))
		switch {
		case strings.Contains(xml, "<failure"):
			s.Events <- Event{Kind: "closed", Data: failureText(xml)}
			return
		case strings.Contains(xml, "urn:ietf:params:xml:ns:xmpp-sasl") && strings.Contains(xml, "mechanism"):
			_ = s.send(s.auth())
		case strings.Contains(xml, "<success"):
			_ = s.send(fmt.Sprintf(
				`<open xmlns='urn:ietf:params:xml:ns:xmpp-framing' to='%s' version='1.0'/>`,
				s.cfg.Domain,
			))
		case strings.Contains(xml, "xmpp-bind") && strings.Contains(xml, "<jid>"):
			s.JID = between(xml, "<jid>", "</jid>")
			s.Events <- Event{Kind: "bound", Data: s.JID}
			_ = s.join()
		case strings.Contains(xml, "xmpp-bind") && strings.Contains(xml, "<bind"):
			_ = s.send(`<iq xmlns='jabber:client' type='set' id='bind1'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>stol</resource></bind></iq>`)
		case strings.Contains(xml, "session-initiate"):
			from := attr(xml, "from")
			s.Events <- Event{Kind: "jingle", Data: xml, From: from}
		case strings.Contains(xml, "source-add") || strings.Contains(xml, "source-remove"):
			from := attr(xml, "from")
			if id := jingle.IQID(xml); id != "" && from != "" {
				_ = s.send(fmt.Sprintf(`<iq xmlns='jabber:client' to='%s' type='result' id='%s'/>`, from, id))
			}
			s.Events <- Event{Kind: "sources", Data: xml, From: from}
		case strings.Contains(xml, "http://jitsi.org/protocol/lobby") || strings.Contains(xml, "<lobby"):
			s.Events <- Event{Kind: "lobby"}
		case strings.Contains(xml, "code='110'"):
			s.Events <- Event{Kind: "joined"}
			_ = s.conference()
		case strings.Contains(xml, "<presence") && !strings.Contains(xml, "type='unavailable'"):
			from := attr(xml, "from")
			if from != "" && !strings.HasSuffix(from, "/"+s.nick) {
				s.Events <- Event{Kind: "occupant", Data: VisibleNick(xml, from), From: from}
			}
		}
	}
}

func (s *Session) auth() string {
	return `<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='ANONYMOUS'/>`
}

func failureText(xml string) string {
	text := between(xml, "<text>", "</text>")
	if text == "" {
		text = "вход отклонён"
	}
	return text
}

func (s *Session) roomJID() string {
	return fmt.Sprintf("%s@%s/%s", s.cfg.Room, s.cfg.MUC, s.nick)
}

func (s *Session) join() error {
	return s.presence()
}

func (s *Session) SetMuted(muted bool) error {
	s.muted.Store(muted)
	if s.JID == "" {
		return nil
	}
	return s.presence()
}

func (s *Session) presence() error {
	flag := "false"
	if s.muted.Load() {
		flag = "true"
	}
	return s.send(presenceXML(s.roomJID(), s.nick, flag))
}

func presenceXML(to, nick, audioMuted string) string {
	return fmt.Sprintf(
		`<presence xmlns='jabber:client' to='%s'><x xmlns='http://jabber.org/protocol/muc'/><nick xmlns='http://jabber.org/protocol/nick'>%s</nick><audiomuted xmlns='http://jitsi.org/jitmeet'>%s</audiomuted><features xmlns='http://jitsi.org/protocol/features'><feature var='http://jitsi.org/protocol/jigasi'/></features></presence>`,
		to, xmlEscape(nick), audioMuted,
	)
}

func (s *Session) Chat(text string) error {
	room := fmt.Sprintf("%s@%s", s.cfg.Room, s.cfg.MUC)
	return s.send(fmt.Sprintf(
		`<message xmlns='jabber:client' to='%s' type='groupchat'><body>%s</body></message>`,
		room, xmlEscape(text),
	))
}

func (s *Session) conference() error {
	id := randomID()
	password := ""
	if s.password != "" {
		password = fmt.Sprintf(`<property name='password' value='%s'/>`, xmlEscape(s.password))
	}
	return s.send(fmt.Sprintf(
		`<iq xmlns='jabber:client' to='focus.%s' type='set' id='%s'><conference xmlns='http://jitsi.org/protocol/focus' room='%s@%s' machine-uid='%s'>%s</conference></iq>`,
		s.cfg.Domain, id, s.cfg.Room, s.cfg.MUC, randomID(), password,
	))
}

func (s *Session) Decline(xml, from string) error {
	if id := jingle.IQID(xml); id != "" && from != "" {
		_ = s.send(fmt.Sprintf(`<iq xmlns='jabber:client' to='%s' type='result' id='%s'/>`, from, id))
	}
	return s.send(jingle.SessionTerminate(randomID(), from, jingle.SessionSID(xml)))
}

func (s *Session) Ack(xml, from string) error {
	id := jingle.IQID(xml)
	if id == "" || from == "" {
		return nil
	}
	return s.send(fmt.Sprintf(`<iq xmlns='jabber:client' to='%s' type='result' id='%s'/>`, from, id))
}

func (s *Session) Accept(offer jingle.Offer, answer jingle.Answer, ssrc uint32) error {
	return s.send(jingle.SessionAccept(randomID(), offer.From, offer.SID, offer.Initiator, answer, ssrc, offer.Contents))
}

func (s *Session) Leave() {
	s.leave.Do(func() {
		_ = s.send(fmt.Sprintf(`<presence xmlns='jabber:client' to='%s' type='unavailable'/>`, s.roomJID()))
		_ = s.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
		_ = s.conn.Close()
	})
}

func VisibleNick(xml, from string) string {
	start := strings.Index(xml, "<nick")
	if start >= 0 {
		rest := xml[start:]
		if open := strings.Index(rest, ">"); open >= 0 {
			rest = rest[open+1:]
			if end := strings.Index(rest, "</nick>"); end > 0 {
				name := strings.TrimSpace(html.UnescapeString(rest[:end]))
				if name != "" {
					return name
				}
			}
		}
	}
	return nickOf(from)
}

func publicEndpoint(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "wss"
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func stanzaName(xml string) string {
	i := strings.Index(xml, "<")
	if i < 0 {
		return "данные"
	}
	rest := strings.TrimLeft(xml[i+1:], "/")
	j := strings.IndexAny(rest, " >/")
	if j < 0 {
		return rest
	}
	if rest[:j] == "" {
		return "данные"
	}
	return rest[:j]
}

func nickOf(jid string) string {
	if i := strings.LastIndex(jid, "/"); i >= 0 {
		return jid[i+1:]
	}
	return jid
}

func attr(xml, name string) string {
	for _, quote := range []string{"'", `"`} {
		if value := between(xml, name+"="+quote, quote); value != "" {
			return value
		}
	}
	return ""
}

func between(xml, start, end string) string {
	i := strings.Index(xml, start)
	if i < 0 {
		return ""
	}
	rest := xml[i+len(start):]
	j := strings.Index(rest, end)
	if j < 0 {
		return ""
	}
	return rest[:j]
}

func xmlEscape(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "'", "&apos;", `"`, "&quot;")
	return replacer.Replace(value)
}

func randomID() string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
