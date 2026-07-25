// backend/internal/libs/ai/session.go
package ai

import (
	"sync"
	"time"
)

// SessionStore menyimpan riwayat percakapan Dora di server, dikunci oleh sessionId.
// Ini menggantikan pola lama (client kirim ulang seluruh array history tiap request) -
// sekarang client cukum kirim sessionId + pesan baru, dan history yang dipakai untuk
// panggilan ke model DIBATASI (trimmed) di server supaya jumlah token per request stabil,
// bukan terus membesar seiring panjang percakapan.
type SessionStore struct {
	mu       sync.Mutex
	sessions map[string]*chatSession
	ttl      time.Duration
	maxTurns int // jumlah pasangan user+assistant terakhir yang dipertahankan
}

type chatSession struct {
	messages   []ChatMessage
	lastActive time.Time
}

func NewSessionStore(ttl time.Duration, maxTurns int) *SessionStore {
	s := &SessionStore{sessions: make(map[string]*chatSession), ttl: ttl, maxTurns: maxTurns}
	go s.janitor()
	return s
}

func (s *SessionStore) janitor() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		s.mu.Lock()
		for id, sess := range s.sessions {
			if time.Since(sess.lastActive) > s.ttl {
				delete(s.sessions, id)
			}
		}
		s.mu.Unlock()
	}
}

// History mengembalikan salinan riwayat pesan (user+assistant, tanpa system prompt) untuk sessionId.
func (s *SessionStore) History(sessionID string) []ChatMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		return nil
	}
	sess.lastActive = time.Now()
	out := make([]ChatMessage, len(sess.messages))
	copy(out, sess.messages)
	return out
}

// Append menambahkan pesan user+assistant baru, lalu memangkas ke maxTurns terakhir
// supaya token yang dikirim ke model tiap request tidak terus membengkak.
func (s *SessionStore) Append(sessionID string, userMsg, assistantMsg ChatMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		sess = &chatSession{}
		s.sessions[sessionID] = sess
	}
	sess.messages = append(sess.messages, userMsg, assistantMsg)
	sess.lastActive = time.Now()

	maxMessages := s.maxTurns * 2
	if len(sess.messages) > maxMessages {
		sess.messages = sess.messages[len(sess.messages)-maxMessages:]
	}
}

// Reset menghapus riwayat sebuah session (dipanggil kalau client mulai chat baru).
func (s *SessionStore) Reset(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}
