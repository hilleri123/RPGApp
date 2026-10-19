package discover

import (
	"fmt"
	"testing"
)

func TestHandshakeTimeoutIsRetried(t *testing.T) {
	if !temporaryNet(fmt.Errorf("Get \"https://peregovorka.mos.ru/room/x\": net/http: TLS handshake timeout")) {
		t.Fatal("таймаут рукопожатия должен повторяться")
	}
	if temporaryNet(fmt.Errorf("комната не выдала ключ входа")) {
		t.Fatal("ошибка комнаты не сетевая")
	}
}

func TestRoomCode(t *testing.T) {
	code, err := RoomCode("https://peregovorka.mos.ru/room/xtsdcwngzn5n")
	if err != nil || code != "xtsdcwngzn5n" {
		t.Fatalf("code %q err %v", code, err)
	}
}

func TestParseConfig(t *testing.T) {
	script := "var config = { hosts: { domain: 'prodperegovorka.mos.ru', muc: 'conference.prodperegovorka.mos.ru' }, websocket: 'wss://prodperegovorka.mos.ru/xmpp-websocket', };"
	cfg, err := ParseConfigJS(script, "prodperegovorka.mos.ru", "xtsdcwngzn5n", "https://peregovorka.mos.ru/room/xtsdcwngzn5n")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Websocket != "wss://prodperegovorka.mos.ru/xmpp-websocket" {
		t.Fatal(cfg.Websocket)
	}
	if cfg.MUC != "conference.prodperegovorka.mos.ru" || cfg.Room != "xtsdcwngzn5n" {
		t.Fatal(cfg)
	}
}

func TestPagePointsAtMeetHost(t *testing.T) {
	page := []byte(`<script src='https://prodperegovorka.mos.ru/external_api.js'></script>`)
	host, err := FromPage(page, "", "")
	if err != nil || host != "prodperegovorka.mos.ru" {
		t.Fatalf("host %q err %v", host, err)
	}
}
