package media

import (
	"sync"

	"table-bridge/internal/jingle"
)

// Book remembers which SSRC belongs to which person. Jitsi sends that later, in source-add.
type Book struct {
	mu     sync.Mutex
	owners map[uint32]string
	self   uint32
}

func NewBook() *Book {
	return &Book{owners: map[uint32]string{}}
}

func (b *Book) Merge(xml string) {
	found := jingle.Owners(xml)
	b.mu.Lock()
	defer b.mu.Unlock()
	for ssrc, owner := range found {
		b.owners[ssrc] = owner
	}
}

func (b *Book) SetSelf(ssrc uint32) {
	b.mu.Lock()
	b.self = ssrc
	b.mu.Unlock()
}

func (b *Book) Identify(ssrc uint32, fallback string) (id, name string, skip bool) {
	b.mu.Lock()
	owner := b.owners[ssrc]
	self := b.self
	b.mu.Unlock()
	if self != 0 && ssrc == self {
		return "", "", true
	}
	if owner == "" {
		owner = fallback
	}
	if jingle.BotOwner(owner) {
		return "", "", true
	}
	name = owner
	if i := lastSlash(owner); i >= 0 {
		name = owner[i+1:]
	}
	return owner, name, false
}
