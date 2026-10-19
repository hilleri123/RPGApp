package jingle

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type Offer struct {
	SID         string
	From        string
	Initiator   string
	Ufrag       string
	Pwd         string
	Fingerprint string
	Candidates  []string
	Contents    []string
}

var (
	sidRe     = regexp.MustCompile(`sid=['"]([^'"]+)['"]`)
	iqIDRe    = regexp.MustCompile(`<iq\b[^>]*\bid=['"]([^'"]+)['"]`)
	initRe    = regexp.MustCompile(`initiator=['"]([^'"]+)['"]`)
	ufragRe   = regexp.MustCompile(`ufrag=['"]([^'"]+)['"]`)
	pwdRe     = regexp.MustCompile(`pwd=['"]([^'"]+)['"]`)
	fpRe      = regexp.MustCompile(`hash=['"]sha-256['"][^>]*>([^<]+)<`)
	candRe    = regexp.MustCompile(`<candidate\b([^>]*)/?>`)
	attrRe    = regexp.MustCompile(`(\w+)=['"]([^'"]*)['"]`)
	contentRe = regexp.MustCompile(`<content\b[^>]*\bname=['"]([^'"]+)['"]`)
	sdpUfrag  = regexp.MustCompile(`a=ice-ufrag:(.+)`)
	sdpPwd    = regexp.MustCompile(`a=ice-pwd:(.+)`)
	sdpFP     = regexp.MustCompile(`a=fingerprint:sha-256 (.+)`)
	sdpCand   = regexp.MustCompile(`a=candidate:(.+)`)
	ownerRe   = regexp.MustCompile(`ssrc=['"](\d+)['"][\s\S]{0,800}?owner=['"]([^'"]+)['"]`)
	paramOwn  = regexp.MustCompile(`ssrc=['"](\d+)['"][\s\S]{0,800}?name=['"]owner['"][^>]*value=['"]([^'"]+)['"]`)
)

func ParseOffer(xml, from string) (Offer, error) {
	offer := Offer{From: from}
	if match := sidRe.FindStringSubmatch(xml); match != nil {
		offer.SID = match[1]
	}
	if match := initRe.FindStringSubmatch(xml); match != nil {
		offer.Initiator = match[1]
	}
	if match := ufragRe.FindStringSubmatch(xml); match != nil {
		offer.Ufrag = match[1]
	}
	if match := pwdRe.FindStringSubmatch(xml); match != nil {
		offer.Pwd = match[1]
	}
	if match := fpRe.FindStringSubmatch(xml); match != nil {
		offer.Fingerprint = strings.TrimSpace(match[1])
	}
	for _, match := range candRe.FindAllStringSubmatch(xml, -1) {
		attrs := map[string]string{}
		for _, attr := range attrRe.FindAllStringSubmatch(match[1], -1) {
			attrs[attr[1]] = attr[2]
		}
		if attrs["ip"] == "" || attrs["port"] == "" {
			continue
		}
		proto := strings.ToLower(attrs["protocol"])
		if proto == "" {
			proto = "udp"
		}
		typ := attrs["type"]
		if typ == "" {
			typ = "host"
		}
		foundation := attrs["foundation"]
		if foundation == "" {
			foundation = "1"
		}
		priority := attrs["priority"]
		if priority == "" {
			priority = "2130706431"
		}
		line := fmt.Sprintf("%s 1 %s %s %s %s typ %s", foundation, proto, priority, attrs["ip"], attrs["port"], typ)
		if attrs["rel-addr"] != "" {
			line += " raddr " + attrs["rel-addr"] + " rport " + attrs["rel-port"]
		}
		if attrs["generation"] != "" {
			line += " generation " + attrs["generation"]
		}
		offer.Candidates = append(offer.Candidates, line)
	}
	for _, match := range contentRe.FindAllStringSubmatch(xml, -1) {
		offer.Contents = append(offer.Contents, match[1])
	}
	if offer.SID == "" || offer.Ufrag == "" || offer.Pwd == "" || offer.Fingerprint == "" {
		return offer, fmt.Errorf("jingle без sid, ice или fingerprint")
	}
	return offer, nil
}

func IsP2P(xml, from string) bool {
	initiator := ""
	if match := initRe.FindStringSubmatch(xml); match != nil {
		initiator = match[1]
	}
	who := strings.ToLower(from + " " + initiator)
	if who == " " || strings.TrimSpace(who) == "" {
		return false
	}
	return !strings.Contains(who, "focus")
}

func IQID(xml string) string {
	match := iqIDRe.FindStringSubmatch(xml)
	if match == nil {
		return ""
	}
	return match[1]
}

func SessionSID(xml string) string {
	match := sidRe.FindStringSubmatch(xml)
	if match == nil {
		return ""
	}
	return match[1]
}

func SessionTerminate(id, to, sid string) string {
	return fmt.Sprintf(`<iq xmlns='jabber:client' to='%s' type='set' id='%s'><jingle xmlns='urn:xmpp:jingle:1' action='session-terminate' sid='%s'><reason><decline/></reason></jingle></iq>`, to, id, sid)
}

func Owners(xml string) map[uint32]string {
	owners := map[uint32]string{}
	take := func(matches [][]string) {
		for _, match := range matches {
			var ssrc uint32
			fmt.Sscanf(match[1], "%d", &ssrc)
			if match[2] != "" {
				owners[ssrc] = match[2]
			}
		}
	}
	take(ownerRe.FindAllStringSubmatch(xml, -1))
	take(paramOwn.FindAllStringSubmatch(xml, -1))
	return owners
}

func BotOwner(owner string) bool {
	name := owner
	if i := strings.LastIndex(owner, "/"); i >= 0 {
		name = owner[i+1:]
	}
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "стол", "stol", "focus":
		return true
	default:
		return false
	}
}

func contentsOf(offer Offer) []string {
	if len(offer.Contents) == 0 {
		return []string{"audio"}
	}
	return offer.Contents
}

func OfferSDP(offer Offer) string {
	contents := contentsOf(offer)
	var b strings.Builder
	b.WriteString("v=0\r\n")
	b.WriteString("o=- 0 0 IN IP4 0.0.0.0\r\n")
	b.WriteString("s=-\r\n")
	b.WriteString("t=0 0\r\n")
	mids := make([]string, len(contents))
	for i := range contents {
		mids[i] = strconv.Itoa(i)
	}
	fmt.Fprintf(&b, "a=group:BUNDLE %s\r\n", strings.Join(mids, " "))
	for i, name := range contents {
		if name == "audio" {
			b.WriteString("m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n")
		} else {
			b.WriteString("m=video 0 UDP/TLS/RTP/SAVPF 0\r\n")
		}
		b.WriteString("c=IN IP4 0.0.0.0\r\n")
		fmt.Fprintf(&b, "a=mid:%d\r\n", i)
		if i == 0 {
			fmt.Fprintf(&b, "a=ice-ufrag:%s\r\n", offer.Ufrag)
			fmt.Fprintf(&b, "a=ice-pwd:%s\r\n", offer.Pwd)
			fmt.Fprintf(&b, "a=fingerprint:sha-256 %s\r\n", offer.Fingerprint)
			b.WriteString("a=setup:actpass\r\n")
			for _, candidate := range offer.Candidates {
				fmt.Fprintf(&b, "a=candidate:%s\r\n", candidate)
			}
		}
		if name == "audio" {
			b.WriteString("a=rtpmap:111 opus/48000/2\r\n")
			b.WriteString("a=fmtp:111 minptime=10;useinbandfec=1\r\n")
			b.WriteString("a=rtcp-mux\r\n")
			b.WriteString("a=sendrecv\r\n")
		} else {
			b.WriteString("a=inactive\r\n")
		}
	}
	return b.String()
}

type Answer struct {
	Ufrag       string
	Pwd         string
	Fingerprint string
	Candidates  []string
}

func ParseAnswerSDP(sdp string) Answer {
	answer := Answer{}
	if match := sdpUfrag.FindStringSubmatch(sdp); match != nil {
		answer.Ufrag = strings.TrimSpace(match[1])
	}
	if match := sdpPwd.FindStringSubmatch(sdp); match != nil {
		answer.Pwd = strings.TrimSpace(match[1])
	}
	if match := sdpFP.FindStringSubmatch(sdp); match != nil {
		answer.Fingerprint = strings.TrimSpace(match[1])
	}
	for _, match := range sdpCand.FindAllStringSubmatch(sdp, -1) {
		answer.Candidates = append(answer.Candidates, strings.TrimSpace(match[1]))
	}
	return answer
}

func candidateXML(line string) string {
	fields := strings.Fields(line)
	if len(fields) < 8 {
		return ""
	}
	attrs := map[string]string{}
	for i := 6; i+1 < len(fields); i += 2 {
		attrs[fields[i]] = fields[i+1]
	}
	rel := ""
	if attrs["raddr"] != "" {
		rel = fmt.Sprintf(" rel-addr='%s' rel-port='%s'", attrs["raddr"], attrs["rport"])
	}
	return fmt.Sprintf("<candidate component='1' foundation='%s' generation='0' id='%s' ip='%s' network='0' port='%s' priority='%s' protocol='%s' type='%s'%s/>",
		fields[0], fields[0]+fields[4], fields[4], fields[5], fields[3], fields[2], attrs["typ"], rel)
}

func SessionAccept(id, to, sid, initiator string, answer Answer, ssrc uint32, contents []string) string {
	if len(contents) == 0 {
		contents = []string{"audio"}
	}
	var cands strings.Builder
	for _, line := range answer.Candidates {
		cands.WriteString(candidateXML(line))
	}
	var body strings.Builder
	for _, name := range contents {
		if name == "audio" {
			fmt.Fprintf(&body, `<content creator='initiator' name='audio' senders='both'><description xmlns='urn:xmpp:jingle:apps:rtp:1' media='audio'><payload-type id='111' name='opus' clockrate='48000' channels='2'><parameter name='minptime' value='10'/><parameter name='useinbandfec' value='1'/></payload-type><source xmlns='urn:xmpp:jingle:apps:rtp:ssma:0' ssrc='%d'/></description><transport xmlns='urn:xmpp:jingle:transports:ice-udp:1' ufrag='%s' pwd='%s'><fingerprint xmlns='urn:xmpp:jingle:apps:dtls:0' hash='sha-256' setup='active'>%s</fingerprint>%s</transport></content>`,
				ssrc, answer.Ufrag, answer.Pwd, answer.Fingerprint, cands.String())
			continue
		}
		fmt.Fprintf(&body, `<content creator='initiator' name='%s' senders='rejected'/>`, name)
	}
	return fmt.Sprintf(`<iq xmlns='jabber:client' to='%s' type='set' id='%s'><jingle xmlns='urn:xmpp:jingle:1' action='session-accept' initiator='%s' responder='%s' sid='%s'>%s</jingle></iq>`,
		to, id, initiator, to, sid, body.String())
}
