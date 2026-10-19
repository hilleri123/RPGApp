package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

type Audio struct {
	Path       string  `json:"path"`
	Volume     float64 `json:"volume"`
	Loop       bool    `json:"loop"`
	Playing    bool    `json:"playing"`
	Position   float64 `json:"position_sec"`
	PositionAt string  `json:"position_at"`
}

type Speaker struct {
	JitsiID string  `json:"jitsi_id"`
	Name    string  `json:"display_name"`
	Bytes   int64   `json:"bytes"`
	Seconds float64 `json:"seconds"`
}

type Table struct {
	ID            string `json:"id"`
	GameSessionID string `json:"game_session_id"`
	RoomURL       string `json:"room_url"`
	RoomCode      string `json:"room_code"`
	Password      string `json:"password"`
	Status        string `json:"status"`
	MusicEnabled  bool   `json:"music_enabled"`
	AutoConnect   bool   `json:"auto_connect"`
	TestRequested bool   `json:"test_requested"`
	Audio         *Audio `json:"audio"`
}

type Client struct {
	Base  string
	Token string
	HTTP  *http.Client
}

func New() Client {
	base := os.Getenv("TABLE_API_URL")
	if base == "" {
		base = "http://app:8000"
	}
	token := os.Getenv("TABLE_BRIDGE_TOKEN")
	if token == "" {
		token = "dev-table-bridge"
	}
	return Client{Base: base, Token: token, HTTP: &http.Client{Timeout: 30 * time.Second}}
}

func (c Client) do(method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, c.Base+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Table-Token", c.Token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.HTTP.Do(req)
}

func (c Client) Active() ([]Table, error) {
	resp, err := c.do(http.MethodGet, "/internal/tables", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("список столов: %s %s", resp.Status, raw)
	}
	var tables []Table
	if err := json.NewDecoder(resp.Body).Decode(&tables); err != nil {
		return nil, err
	}
	return tables, nil
}

func (c Client) Status(id, status, detail string) error {
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/status", map[string]string{
		"status": status,
		"detail": detail,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("статус: %s %s", resp.Status, raw)
	}
	return nil
}

func (c Client) Report(id, text string) error {
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/test", map[string]string{
		"text": text,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("отчёт: %s %s", resp.Status, raw)
	}
	return nil
}

func (c Client) Participant(id, jitsiID, name string) error {
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/participants", map[string]string{
		"jitsi_id":     jitsiID,
		"display_name": name,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	return nil
}

func (c Client) Cursor(id string) (*Audio, error) {
	resp, err := c.do(http.MethodGet, "/internal/tables/"+id+"/mix", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("микшер: %s %s", resp.Status, raw)
	}
	var body struct {
		Audio *Audio `json:"audio"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	return body.Audio, nil
}

func (c Client) Heard(id string, speakers []Speaker, drop []string) error {
	if speakers == nil {
		speakers = []Speaker{}
	}
	if drop == nil {
		drop = []string{}
	}
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/mix", map[string]any{
		"speakers": speakers,
		"drop":     drop,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("запись: %s", resp.Status)
	}
	return nil
}

func (c Client) Music(id, path string, started, ended time.Time, from, to float64) error {
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/music", map[string]any{
		"path":           path,
		"started_at":     started.UTC().Format(time.RFC3339Nano),
		"ended_at":       ended.UTC().Format(time.RFC3339Nano),
		"position_start": from,
		"position_end":   to,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("отрезок музыки: %s", resp.Status)
	}
	return nil
}

func (c Client) Progress(id, jitsiID, name string, nbytes int64, seconds float64) error {
	resp, err := c.do(http.MethodPost, "/internal/tables/"+id+"/progress", map[string]any{
		"jitsi_id":     jitsiID,
		"display_name": name,
		"bytes":        nbytes,
		"seconds":      seconds,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("прогресс: %s", resp.Status)
	}
	return nil
}

func (c Client) Segment(id, jitsiID, name string, started, ended time.Time, file []byte) error {
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)
	_ = form.WriteField("jitsi_id", jitsiID)
	_ = form.WriteField("display_name", name)
	_ = form.WriteField("started_at", started.UTC().Format(time.RFC3339Nano))
	_ = form.WriteField("ended_at", ended.UTC().Format(time.RFC3339Nano))
	part, err := form.CreateFormFile("file", "segment.ogg")
	if err != nil {
		return err
	}
	if _, err := part.Write(file); err != nil {
		return err
	}
	form.Close()
	req, err := http.NewRequest(http.MethodPost, c.Base+"/internal/tables/"+id+"/segments", &buf)
	if err != nil {
		return err
	}
	req.Header.Set("X-Table-Token", c.Token)
	req.Header.Set("Content-Type", form.FormDataContentType())
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("сегмент: %s %s", resp.Status, raw)
	}
	return nil
}
