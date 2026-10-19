package media

import (
	"time"

	"table-bridge/internal/api"
)

// OpenCue is the song the room is hearing right now.
type OpenCue struct {
	Path  string
	Wall  time.Time
	Start float64
	Last  float64
}

// ClosedCue is one played piece: file path and the range inside it.
type ClosedCue struct {
	Path    string
	Started time.Time
	Ended   time.Time
	From    float64
	To      float64
}

func Follow(open *OpenCue, audio *api.Audio, now time.Time) (*ClosedCue, *OpenCue) {
	if audio == nil || !audio.Playing || audio.Path == "" {
		return closeCue(open, now), nil
	}
	pos := cursorSec(audio, now)
	if open == nil || open.Path == "" {
		return nil, &OpenCue{Path: audio.Path, Wall: now, Start: pos, Last: pos}
	}
	if open.Path != audio.Path || pos+0.4 < open.Last || pos > open.Last+2.5 {
		closed := closeCue(open, now)
		return closed, &OpenCue{Path: audio.Path, Wall: now, Start: pos, Last: pos}
	}
	open.Last = pos
	return nil, open
}

func closeCue(open *OpenCue, now time.Time) *ClosedCue {
	if open == nil || open.Path == "" || now.Sub(open.Wall) < 400*time.Millisecond {
		return nil
	}
	end := open.Last
	if end < open.Start {
		end = open.Start
	}
	return &ClosedCue{Path: open.Path, Started: open.Wall, Ended: now, From: open.Start, To: end}
}

func cursorSec(audio *api.Audio, now time.Time) float64 {
	pos := audio.Position
	if audio.Playing && audio.PositionAt != "" {
		if mark, err := parseMark(audio.PositionAt); err == nil {
			pos += now.Sub(mark).Seconds()
		}
	}
	if pos < 0 {
		return 0
	}
	return pos
}
