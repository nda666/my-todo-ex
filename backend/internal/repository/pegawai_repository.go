package repository

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"golang-todo/internal/libs/cache"
	"golang-todo/internal/libs/doranapi"
	"golang-todo/internal/models"

	"gorm.io/gorm"
)

type PegawaiRepository interface {
	FindByDivisi(ctx context.Context, token string, kodeDivisi int) ([]models.Pegawai, error)
	FindByKode(ctx context.Context, token string, kodeDivisi, kode int) (*models.Pegawai, error)
	FindByDivisiAndSearchName(ctx context.Context, token string, kodeDivisi int, search *string) ([]models.Pegawai, error)
}

type pegawaiRepository struct {
	client *doranapi.Client
	cache  *cache.Cache
	db     *gorm.DB
}

func NewPegawaiRepository(client *doranapi.Client, c *cache.Cache, db *gorm.DB) PegawaiRepository {
	return &pegawaiRepository{client: client, cache: c, db: db}
}

func (r *pegawaiRepository) wrapperFind(ctx context.Context, token string, kodeDivisi int, search *string) ([]models.Pegawai, error) {
	key := fmt.Sprintf("pegawai:divisi:%d", kodeDivisi)
	// items, err := r.client.GetAllPegawaiByDivisi(ctx, token, kodeDivisi)
	items, err := cache.Fetch(ctx, r.cache, key, func(ctx context.Context) ([]doranapi.PegawaiItem, error) {
		return r.client.GetAllPegawaiByDivisi(ctx, token, kodeDivisi)
	})
	if err != nil {
		return nil, err
	}

	var keyword string
	if search != nil {
		keyword = strings.ToLower(*search)
	}
	var result []models.Pegawai

	for _, it := range items {
		if keyword != "" && !strings.Contains(strings.ToLower(it.Nama), keyword) {
			continue
		}

		result = append(result, models.Pegawai{
			Kode:         it.Kode,
			Nama:         it.Nama,
			KodeJabatan:  it.KodeJabatan,
			KodeDivisi:   it.KodeDivisi,
			StatusLeader: it.StatusLeader,
			Jabatan:      &models.Jabatan{Kode: it.KodeJabatan, Nama: it.NamaJabatan},
		})
	}

	sort.SliceStable(result, func(i, j int) bool {
		if result[i].StatusLeader != result[j].StatusLeader {
			return result[i].StatusLeader > result[j].StatusLeader
		}
		return result[i].Nama < result[j].Nama
	})

	return result, nil
}

func (r *pegawaiRepository) FindByDivisiAndSearchName(ctx context.Context, token string, kodeDivisi int, search *string) ([]models.Pegawai, error) {
	members, err := r.wrapperFind(ctx, token, kodeDivisi, search)
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (r *pegawaiRepository) FindByDivisi(ctx context.Context, token string, kodeDivisi int) ([]models.Pegawai, error) {
	members, err := r.wrapperFind(ctx, token, kodeDivisi, nil)
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (r *pegawaiRepository) FindByKode(ctx context.Context, token string, kodeDivisi, kode int) (*models.Pegawai, error) {
	members, err := r.wrapperFind(ctx, token, kodeDivisi, nil)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		if m.Kode == kode {
			return &m, nil
		}
	}
	return nil, fmt.Errorf("pegawai tidak ditemukan")
}
