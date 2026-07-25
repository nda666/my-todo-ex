package repository

import (
	"context"

	"golang-todo/internal/libs/cache"
	"golang-todo/internal/libs/doranapi"
	"golang-todo/internal/models"
)

type DivisionSummary struct {
	Kode        int
	Nama        string
	LeaderName  string
	MemberCount int
}

type DivisiRepository interface {
	List(ctx context.Context, token string) ([]models.Divisi, error)
	Summaries(ctx context.Context, token string) ([]DivisionSummary, error)
}

type divisiRepository struct {
	client      *doranapi.Client
	cache       *cache.Cache
	pegawaiRepo PegawaiRepository
}

func NewDivisiRepository(client *doranapi.Client, c *cache.Cache, pegawaiRepo PegawaiRepository) DivisiRepository {
	return &divisiRepository{client: client, cache: c, pegawaiRepo: pegawaiRepo}
}

func (r *divisiRepository) List(ctx context.Context, token string) ([]models.Divisi, error) {
	return cache.Fetch(ctx, r.cache, "divisions", func(ctx context.Context) ([]models.Divisi, error) {
		items, err := r.client.GetDivisions(ctx, token)
		if err != nil {
			return nil, err
		}
		result := make([]models.Divisi, len(items))
		for i, it := range items {
			result[i] = models.Divisi{Kode: it.Kode, Nama: it.Nama}
		}
		return result, nil
	})
}

func (r *divisiRepository) Summaries(ctx context.Context, token string) ([]DivisionSummary, error) {
	divisions, err := r.List(ctx, token)
	if err != nil {
		return nil, err
	}

	result := make([]DivisionSummary, len(divisions))
	for i, d := range divisions {
		members, err := r.pegawaiRepo.FindByDivisi(ctx, token, d.Kode)
		if err != nil {
			result[i] = DivisionSummary{Kode: d.Kode, Nama: d.Nama}
			continue
		}
		leaderName := ""
		for _, m := range members {
			if m.StatusLeader == 1 {
				leaderName = m.Nama
				break
			}
		}
		result[i] = DivisionSummary{Kode: d.Kode, Nama: d.Nama, LeaderName: leaderName, MemberCount: len(members)}
	}
	return result, nil
}
