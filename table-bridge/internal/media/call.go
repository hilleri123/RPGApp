package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/pion/webrtc/v4/pkg/media/oggwriter"

	"table-bridge/internal/api"
	"table-bridge/internal/jingle"
)

var silence = []byte{0xf8, 0xff, 0xfe}

type SegmentFunc func(jitsiID, name string, started, ended time.Time, file []byte)

type ProgressFunc func(jitsiID, name string, nbytes int64, seconds float64, replaced string)

func Answer(ctx context.Context, raw, from string, audio *atomic.Pointer[api.Audio], book *Book, client api.Client, onSegment SegmentFunc, onProgress ProgressFunc) (jingle.Answer, uint32, func(), error) {
	offer, err := jingle.ParseOffer(raw, from)
	if err != nil {
		return jingle.Answer{}, 0, nil, err
	}
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
	})
	if err != nil {
		return jingle.Answer{}, 0, nil, err
	}
	track, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{
		MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2,
	}, "audio", "table")
	if err != nil {
		pc.Close()
		return jingle.Answer{}, 0, nil, err
	}
	sender, err := pc.AddTrack(track)
	if err != nil {
		pc.Close()
		return jingle.Answer{}, 0, nil, err
	}
	go play(ctx, track, audio)
	if book == nil {
		book = NewBook()
	}
	book.Merge(raw)
	pc.OnTrack(func(remote *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		if remote.Codec().MimeType != webrtc.MimeTypeOpus {
			return
		}
		record(remote, book, onSegment, onProgress)
	})
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: jingle.OfferSDP(offer)}); err != nil {
		pc.Close()
		return jingle.Answer{}, 0, nil, err
	}
	local, err := pc.CreateAnswer(nil)
	if err != nil {
		pc.Close()
		return jingle.Answer{}, 0, nil, err
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(local); err != nil {
		pc.Close()
		return jingle.Answer{}, 0, nil, err
	}
	select {
	case <-gather:
	case <-time.After(4 * time.Second):
	}
	desc := pc.LocalDescription()
	var ssrc uint32
	params := sender.GetParameters()
	if len(params.Encodings) > 0 && params.Encodings[0].SSRC != 0 {
		ssrc = uint32(params.Encodings[0].SSRC)
	} else {
		_ = binary.Read(rand.Reader, binary.BigEndian, &ssrc)
	}
	book.SetSelf(ssrc)
	log.Printf("свой звук ssrc %d", ssrc)
	return jingle.ParseAnswerSDP(desc.SDP), ssrc, func() { _ = pc.Close() }, nil
}

func record(remote *webrtc.TrackRemote, book *Book, onSegment SegmentFunc, onProgress ProgressFunc) {
	if onSegment == nil || book == nil {
		return
	}
	ssrc := uint32(remote.SSRC())
	fallback := fmt.Sprintf("ssrc-%d", ssrc)
	var writer *oggwriter.OggWriter
	var path string
	var heard int64
	started := time.Now()
	reported := started
	posted := ""
	logged := false
	discard := false
	for {
		packet, _, err := remote.ReadRTP()
		if err != nil {
			break
		}
		id, name, skip := book.Identify(ssrc, fallback)
		if !logged {
			logged = true
			log.Printf("входящий звук ssrc %d, кто %q", ssrc, id)
		}
		if skip {
			discard = true
			if writer != nil {
				_ = writer.Close()
				os.Remove(path)
				writer = nil
			}
			if posted != "" && onProgress != nil {
				onProgress("", "", 0, 0, posted)
				posted = ""
			}
			continue
		}
		if writer == nil {
			file, err := os.CreateTemp("", "table-*.ogg")
			if err != nil {
				continue
			}
			path = file.Name()
			file.Close()
			writer, err = oggwriter.New(path, 48000, 2)
			if err != nil {
				os.Remove(path)
				continue
			}
			started = time.Now()
			reported = started
			heard = 0
		}
		_ = writer.WriteRTP(packet)
		heard += int64(len(packet.Payload))
		if onProgress != nil && time.Since(reported) >= 3*time.Second {
			reported = time.Now()
			replaced := ""
			if posted != "" && posted != id {
				replaced = posted
			}
			posted = id
			onProgress(id, name, heard, time.Since(started).Seconds(), replaced)
		}
	}
	if writer == nil || discard {
		if writer != nil {
			_ = writer.Close()
			os.Remove(path)
		}
		return
	}
	_ = writer.Close()
	id, name, skip := book.Identify(ssrc, fallback)
	payload, err := os.ReadFile(path)
	os.Remove(path)
	if skip || err != nil || len(payload) == 0 {
		return
	}
	onSegment(id, name, started, time.Now(), payload)
}

func play(ctx context.Context, track *webrtc.TrackLocalStaticSample, audio *atomic.Pointer[api.Audio]) {
	var packets []media.Sample
	loaded := ""
	for {
		current := audio.Load()
		key := ""
		if current != nil && current.Path != "" {
			key = current.Path + "|" + formatVolume(current.Volume)
		}
		if key != loaded {
			packets = nil
			loaded = key
			if current != nil && current.Path != "" {
				file, err := mediaFile(current.Path)
				if err != nil {
					log.Printf("музыка: %v", err)
				} else if opus, err := toOpus(file, current.Volume); err != nil {
					log.Printf("музыка: %v", err)
				} else {
					packets = opusPackets(opus)
					log.Printf("музыка: %s, %d пакетов", current.Path, len(packets))
				}
			}
		}
		sample := media.Sample{Data: silence, Duration: 20 * time.Millisecond}
		if current != nil && current.Playing && len(packets) > 0 {
			sample = packets[packetAt(packets, heardPosition(current), current.Loop)]
		}
		_ = track.WriteSample(sample)
		timer := time.NewTimer(sample.Duration)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func heardPosition(current *api.Audio) time.Duration {
	position := time.Duration(current.Position * float64(time.Second))
	if current.Playing && current.PositionAt != "" {
		if mark, err := parseMark(current.PositionAt); err == nil {
			position += time.Since(mark)
		}
	}
	if position < 0 {
		return 0
	}
	return position
}

func parseMark(value string) (time.Time, error) {
	if mark, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return mark, nil
	}
	mark, err := time.Parse("2006-01-02T15:04:05.999999", value)
	if err != nil {
		return time.Time{}, err
	}
	return mark.UTC(), nil
}

func packetAt(packets []media.Sample, at time.Duration, loop bool) int {
	var total time.Duration
	for _, packet := range packets {
		total += packet.Duration
	}
	if total <= 0 {
		return 0
	}
	if loop {
		at %= total
	} else if at >= total {
		return len(packets) - 1
	}
	var walked time.Duration
	for i, packet := range packets {
		walked += packet.Duration
		if walked > at {
			return i
		}
	}
	return len(packets) - 1
}

func mediaFile(relative string) (string, error) {
	root := os.Getenv("MEDIA_ROOT")
	if root == "" {
		root = "/app/media"
	}
	root = filepath.Clean(root)
	clean := filepath.Clean(relative)
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("трек вне каталога записей")
	}
	full := filepath.Join(root, clean)
	if rel, err := filepath.Rel(root, full); err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("трек вне каталога записей")
	}
	return full, nil
}

func toOpus(path string, volume float64) ([]byte, error) {
	if volume <= 0 {
		volume = 1
	}
	cmd := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path,
		"-filter:a", "volume="+formatVolume(volume),
		"-c:a", "libopus", "-ar", "48000", "-ac", "2", "-frame_duration", "20",
		"-f", "ogg", "-page_duration", "20000", "pipe:1")
	return cmd.Output()
}

func formatVolume(volume float64) string {
	return strconv.FormatFloat(volume, 'f', 3, 64)
}

func opusPackets(payload []byte) []media.Sample {
	reader := bytes.NewReader(payload)
	var packets []media.Sample
	var last uint64
	for {
		granule, segments, err := readOggPage(reader)
		if err != nil {
			break
		}
		audio := make([][]byte, 0, len(segments))
		for _, segment := range segments {
			if bytes.HasPrefix(segment, []byte("OpusHead")) || bytes.HasPrefix(segment, []byte("OpusTags")) {
				continue
			}
			if len(segment) > 0 {
				audio = append(audio, segment)
			}
		}
		span := 20 * time.Millisecond
		if granule > last && len(audio) > 0 {
			span = time.Duration((granule-last)*uint64(time.Second)/48000) / time.Duration(len(audio))
			last = granule
		}
		if span <= 0 || span > time.Second {
			span = 20 * time.Millisecond
		}
		for _, segment := range audio {
			packets = append(packets, media.Sample{Data: segment, Duration: span})
		}
	}
	return packets
}

func readOggPage(reader io.Reader) (uint64, [][]byte, error) {
	header := make([]byte, 27)
	if _, err := io.ReadFull(reader, header); err != nil {
		return 0, nil, err
	}
	if string(header[:4]) != "OggS" {
		return 0, nil, io.ErrUnexpectedEOF
	}
	granule := binary.LittleEndian.Uint64(header[6:14])
	table := make([]byte, header[26])
	if _, err := io.ReadFull(reader, table); err != nil {
		return 0, nil, err
	}
	var segments [][]byte
	var current []byte
	for _, size := range table {
		chunk := make([]byte, size)
		if _, err := io.ReadFull(reader, chunk); err != nil {
			return 0, nil, err
		}
		current = append(current, chunk...)
		if size < 255 {
			segments = append(segments, current)
			current = nil
		}
	}
	if len(current) > 0 {
		segments = append(segments, current)
	}
	return granule, segments, nil
}

func lastSlash(value string) int {
	for i := len(value) - 1; i >= 0; i-- {
		if value[i] == '/' {
			return i
		}
	}
	return -1
}
