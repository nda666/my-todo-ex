package pubsub

import (
	"sync"
)

type EventType string

const (
	TaskCreated EventType = "CREATED"
	TaskUpdated EventType = "UPDATED"
	TaskDeleted EventType = "DELETED"
)

type TaskEvent struct {
	Action     EventType   `json:"action"`
	Task       interface{} `json:"task,omitempty"`
	TaskID     string      `json:"taskId,omitempty"`
	DivisiKode int         `json:"divisiKode"`
	UserKode   string      `json:"userKode"`
}

type Broker struct {
	mu          sync.RWMutex
	subscribers map[chan *TaskEvent]int // map chan -> filter divisiKode (0 = receive all)
}

var DefaultBroker = NewBroker()

func NewBroker() *Broker {
	return &Broker{
		subscribers: make(map[chan *TaskEvent]int),
	}
}

// Subscribe registers a subscriber channel. divisiKode = 0 subscribes to all divisions.
func (b *Broker) Subscribe(divisiKode int) (chan *TaskEvent, func()) {
	ch := make(chan *TaskEvent, 100)

	b.mu.Lock()
	b.subscribers[ch] = divisiKode
	b.mu.Unlock()

	unsubscribe := func() {
		b.mu.Lock()
		if _, exists := b.subscribers[ch]; exists {
			delete(b.subscribers, ch)
			close(ch)
		}
		b.mu.Unlock()
	}

	return ch, unsubscribe
}

// Publish broadcasts a TaskEvent to relevant subscribers.
func (b *Broker) Publish(event *TaskEvent) {
	if event == nil {
		return
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch, divFilter := range b.subscribers {
		// Deliver if subscriber listens to all (0), event has no specific division (0), or divisions match
		if divFilter == 0 || event.DivisiKode == 0 || divFilter == event.DivisiKode {
			select {
			case ch <- event:
			default:
				// Non-blocking write: if subscriber buffer is full, do not block other subscribers
			}
		}
	}
}
