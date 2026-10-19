package discover

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type Config struct {
	RoomURL   string
	Room      string
	MeetHost  string
	Domain    string
	MUC       string
	Websocket string
	Token     string
	Title     string
}

var (
	externalAPI = regexp.MustCompile(`https://([^/'"]+)/external_api\.js`)
	field       = regexp.MustCompile(`\b(domain|muc|websocket):\s*'([^']+)'`)
	roomPath    = regexp.MustCompile(`/room/([^/?#]+)`)
)

func RoomCode(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "peregovorka.mos.ru" && host != "prodperegovorka.mos.ru" {
		return "", fmt.Errorf("пока только Переговорка, получено %s", host)
	}
	match := roomPath.FindStringSubmatch(parsed.Path)
	if match == nil {
		return "", fmt.Errorf("в ссылке нет кода комнаты")
	}
	return match[1], nil
}

func ParseConfigJS(body, meetHost, room, roomURL string) (Config, error) {
	found := map[string]string{}
	for _, match := range field.FindAllStringSubmatch(body, -1) {
		found[match[1]] = match[2]
	}
	if found["domain"] == "" || found["muc"] == "" || found["websocket"] == "" {
		return Config{}, fmt.Errorf("в config.js нет domain, muc или websocket")
	}
	return Config{
		RoomURL:   roomURL,
		Room:      room,
		MeetHost:  meetHost,
		Domain:    found["domain"],
		MUC:       found["muc"],
		Websocket: found["websocket"],
	}, nil
}

func FromPage(page []byte, roomURL, room string) (string, error) {
	match := externalAPI.FindSubmatch(page)
	if match == nil {
		return "", fmt.Errorf("на странице комнаты нет external_api.js")
	}
	return string(match[1]), nil
}

func httpClient() *http.Client {
	base, _ := http.DefaultTransport.(*http.Transport)
	transport := base.Clone()
	transport.TLSHandshakeTimeout = 45 * time.Second
	return &http.Client{Timeout: 90 * time.Second, Transport: transport}
}

func temporaryNet(err error) bool {
	text := err.Error()
	return strings.Contains(text, "TLS handshake timeout") ||
		strings.Contains(text, "timeout") ||
		strings.Contains(text, "connection reset") ||
		strings.Contains(text, "EOF")
}

func visibleURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	query := parsed.Query()
	if query.Has("token") || query.Has("jwt") {
		query.Del("token")
		query.Del("jwt")
		parsed.RawQuery = query.Encode()
	}
	return parsed.String()
}

func retryGet(client *http.Client, rawURL string) (*http.Response, error) {
	var last error
	shown := visibleURL(rawURL)
	for attempt := 1; attempt <= 3; attempt++ {
		started := time.Now()
		log.Printf("переговорка → GET %s, попытка %d", shown, attempt)
		resp, err := client.Get(rawURL)
		elapsed := time.Since(started).Round(time.Millisecond)
		if err == nil {
			log.Printf("переговорка ← GET %s → %d за %s", shown, resp.StatusCode, elapsed)
			return resp, nil
		}
		log.Printf("переговорка ← GET %s за %s: %v", shown, elapsed, err)
		last = err
		if attempt == 3 || !temporaryNet(err) {
			return nil, err
		}
		time.Sleep(time.Duration(attempt) * time.Second)
	}
	return nil, last
}

func Discover(roomURL string) (Config, error) {
	room, err := RoomCode(roomURL)
	if err != nil {
		return Config{}, err
	}
	client := httpClient()
	page, err := retryGet(client, roomURL)
	if err != nil {
		return Config{}, err
	}
	defer page.Body.Close()
	body, err := io.ReadAll(io.LimitReader(page.Body, 1<<20))
	if err != nil {
		return Config{}, err
	}
	meetHost, err := FromPage(body, roomURL, room)
	if err != nil {
		return Config{}, err
	}
	configURL := "https://" + meetHost + "/config.js"
	resp, err := retryGet(client, configURL)
	if err != nil {
		return Config{}, err
	}
	defer resp.Body.Close()
	script, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Config{}, err
	}
	cfg, err := ParseConfigJS(string(script), meetHost, room, roomURL)
	if err != nil {
		return Config{}, err
	}
	token, title, err := guestToken(client, room)
	if err != nil {
		return Config{}, err
	}
	cfg.Token = token
	cfg.Title = title
	return cfg, nil
}

func guestToken(client *http.Client, room string) (string, string, error) {
	endpoint := "https://peregovorka.mos.ru/api/v1/rooms/" + url.PathEscape(room) + "/connect/"
	resp, err := retryGet(client, endpoint)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("ключ комнаты: %s", resp.Status)
	}
	var body struct {
		JWT  string `json:"jwt"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return "", "", err
	}
	if body.JWT == "" {
		return "", "", fmt.Errorf("комната не выдала ключ входа")
	}
	return body.JWT, body.Name, nil
}
