package jingle

import "testing"

const sample = `<iq from='focus@example' id='a1' type='set'><jingle xmlns='urn:xmpp:jingle:1' action='session-initiate' initiator='focus@example/x' sid='sid1'><content name='audio'><transport ufrag='ufrag1' pwd='pwdvalue'><fingerprint xmlns='urn:xmpp:jingle:apps:dtls:0' hash='sha-256'>AA:BB</fingerprint><candidate foundation='1' component='1' protocol='udp' priority='2130706431' ip='10.0.0.8' port='10000' type='host' generation='0'/></transport></content></jingle></iq>`

func TestAnswerKeepsMediaOrder(t *testing.T) {
	raw := `<iq from="focus.example/focus" id="a1" type="set"><jingle action="session-initiate" initiator="focus.example/focus" sid="sid1"><content name="audio"><transport ufrag="ufrag1" pwd="pwdvalue"><fingerprint hash="sha-256">AA:BB</fingerprint></transport></content><content name="video"><transport ufrag="ufrag1" pwd="pwdvalue"><fingerprint hash="sha-256">AA:BB</fingerprint></transport></content></jingle></iq>`
	offer, err := ParseOffer(raw, "focus.example/focus")
	if err != nil {
		t.Fatal(err)
	}
	if IsP2P(raw, "focus.example/focus") {
		t.Fatal("видеомост с двойными кавычками принят за прямой звонок")
	}
	sdp := OfferSDP(offer)
	audioAt := indexOf(sdp, "m=audio")
	videoAt := indexOf(sdp, "m=video 0")
	if audioAt < 0 || videoAt < audioAt {
		t.Fatal(sdp)
	}
	xml := SessionAccept("id", "focus.example/focus", offer.SID, offer.Initiator, Answer{}, 7, offer.Contents)
	if indexOf(xml, "name='video' senders='rejected'") < indexOf(xml, "name='audio'") {
		t.Fatal(xml)
	}
}

func TestP2PIsNotTheBridge(t *testing.T) {
	bridge := `<iq from='focus.example/focus' id='a1' type='set'><jingle action='session-initiate' initiator='focus.example/focus' sid='sid1'>`
	if IsP2P(bridge, "focus.example/focus") {
		t.Fatal("предложение видеомоста принято за прямой звонок")
	}
	direct := `<iq from='user@example/res' id='b1' type='set'><jingle action='session-initiate' initiator='user@example/res' sid='sid2'>`
	if !IsP2P(direct, "user@example/res") {
		t.Fatal("прямой звонок не распознан")
	}
	if IQID(direct) != "b1" || SessionSID(direct) != "sid2" {
		t.Fatal(IQID(direct), SessionSID(direct))
	}
}

func TestOfferRoundTrip(t *testing.T) {
	offer, err := ParseOffer(sample, "focus@example")
	if err != nil {
		t.Fatal(err)
	}
	if offer.SID != "sid1" || offer.Ufrag != "ufrag1" || len(offer.Candidates) != 1 {
		t.Fatalf("%+v", offer)
	}
	sdp := OfferSDP(offer)
	if !contains(sdp, "a=ice-ufrag:ufrag1") || !contains(sdp, "10.0.0.8") {
		t.Fatal(sdp)
	}
	answer := ParseAnswerSDP("a=ice-ufrag:ou\r\na=ice-pwd:op\r\na=fingerprint:sha-256 CC:DD\r\na=candidate:1 1 udp 1 1.2.3.4 9 typ host\r\n")
	xml := SessionAccept("id", "focus@example", offer.SID, offer.Initiator, answer, 42, offer.Contents)
	if !contains(xml, "session-accept") || !contains(xml, "1.2.3.4") {
		t.Fatal(xml)
	}
}

func TestSourceAddNamesThePerson(t *testing.T) {
	xml := `<iq id='s1' from='focus.example/focus'><jingle action='source-add'><source ssrc='400' xmlns='urn:xmpp:jingle:apps:rtp:ssma:0'><ssrc-info owner='room@muc/7e5fff80' xmlns='http://jitsi.org/jitmeet'/></source><source ssrc='7'><ssrc-info owner='room@muc/Стол'/></source></jingle></iq>`
	owners := Owners(xml)
	if owners[400] != "room@muc/7e5fff80" {
		t.Fatal(owners)
	}
	if !BotOwner(owners[7]) || BotOwner(owners[400]) {
		t.Fatal(owners)
	}
}

func contains(s, part string) bool {
	return len(s) >= len(part) && (s == part || len(part) == 0 || (len(s) > 0 && (indexOf(s, part) >= 0)))
}

func indexOf(s, part string) int {
	for i := 0; i+len(part) <= len(s); i++ {
		if s[i:i+len(part)] == part {
			return i
		}
	}
	return -1
}
