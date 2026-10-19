package media

import (
	"testing"
	"time"

	pion "github.com/pion/webrtc/v4/pkg/media"
)

func TestPacketFollowsSharedClock(t *testing.T) {
	packets := []pion.Sample{
		{Duration: 20 * time.Millisecond},
		{Duration: 20 * time.Millisecond},
		{Duration: 20 * time.Millisecond},
	}
	if got := packetAt(packets, 0, false); got != 0 {
		t.Fatalf("начало: %d", got)
	}
	if got := packetAt(packets, 25*time.Millisecond, false); got != 1 {
		t.Fatalf("середина: %d", got)
	}
	if got := packetAt(packets, 100*time.Millisecond, true); got != 2 {
		t.Fatalf("петля: %d", got)
	}
	if got := packetAt(packets, 5*time.Second, false); got != 2 {
		t.Fatalf("конец: %d", got)
	}
}
