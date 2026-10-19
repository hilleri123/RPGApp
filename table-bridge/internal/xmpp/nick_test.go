package xmpp

import (
	"strings"
	"testing"
)

func TestVisibleNickIsTheNameFromTheRoom(t *testing.T) {
	xml := `<presence from='room@muc/7e5fff80'><nick xmlns='http://jabber.org/protocol/nick'>Александр</nick></presence>`
	if got := VisibleNick(xml, "room@muc/7e5fff80"); got != "Александр" {
		t.Fatal(got)
	}
}

func TestPublicEndpointHidesTheToken(t *testing.T) {
	got := publicEndpoint("wss://prodperegovorka.mos.ru/xmpp-websocket?token=secret")
	if strings.Contains(got, "secret") || strings.Contains(got, "token") {
		t.Fatal(got)
	}
}

func TestStanzaName(t *testing.T) {
	if stanzaName(`<presence xmlns='jabber:client'><nick>А</nick></presence>`) != "presence" {
		t.Fatal(stanzaName(`<presence xmlns='jabber:client'>`))
	}
}

func TestPresenceTellsTheRoomThereIsNoDirectCall(t *testing.T) {
	xml := presenceXML("room@muc/Стол", "Стол", "true")
	if !strings.Contains(xml, "http://jitsi.org/protocol/jigasi") {
		t.Fatal(xml)
	}
}

func TestVisibleNickFallsBackToTheEndpoint(t *testing.T) {
	xml := `<presence from='room@muc/7e5fff80'></presence>`
	if got := VisibleNick(xml, "room@muc/7e5fff80"); got != "7e5fff80" {
		t.Fatal(got)
	}
}
