package cache

import (
	"context"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"golang.org/x/sync/singleflight"
)

// Cache adalah TTL cache + request dedupe untuk data dari API eksternal.
// Kalau ada beberapa request konkuren minta key yang sama sebelum cache keisi,
// cuma satu yang beneran manggil fetchFn - sisanya nunggu hasil yang sama.
type Cache struct {
	store *gocache.Cache
	group singleflight.Group
	ttl   time.Duration
}

func New(ttl time.Duration) *Cache {
	return &Cache{store: gocache.New(ttl, ttl*2), ttl: ttl}
}

func Fetch[T any](ctx context.Context, c *Cache, key string, fetchFn func(ctx context.Context) (T, error)) (T, error) {
	if cached, found := c.store.Get(key); found {
		return cached.(T), nil
	}

	result, err, _ := c.group.Do(key, func() (interface{}, error) {
		if cached, found := c.store.Get(key); found {
			return cached, nil
		}
		val, err := fetchFn(ctx)
		if err != nil {
			return nil, err
		}
		c.store.Set(key, val, c.ttl)
		return val, nil
	})

	if err != nil {
		var zero T
		return zero, err
	}
	return result.(T), nil
}

// Invalidate hapus satu key dari cache (dipakai kalau ada perubahan lokal, misal status leader diubah).
func (c *Cache) Invalidate(key string) {
	c.store.Delete(key)
}
