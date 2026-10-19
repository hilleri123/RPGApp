package media

import (
	"testing"
	"time"

	"table-bridge/internal/api"
)

func TestCueRemembersThePlayedSlice(t *testing.T) {
	start := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	audio := &api.Audio{Path: "audio/theme.mp3", Playing: true, Position: 10}
	_, open := Follow(nil, audio, start)
	audio.Position = 12
	_, open = Follow(open, audio, start.Add(time.Second))
	audio.Position = 40
	closed, next := Follow(open, audio, start.Add(2*time.Second))
	if closed == nil || closed.Path != "audio/theme.mp3" || closed.From != 10 || closed.To != 12 {
		t.Fatalf("%+v", closed)
	}
	if next == nil || next.Start != 40 {
		t.Fatalf("%+v", next)
	}
	done, empty := Follow(next, nil, start.Add(5*time.Second))
	if empty != nil || done == nil || done.From != 40 {
		t.Fatalf("%+v %v", done, empty)
	}
}
