package auth

import (
	"context"
	"errors"
	"strconv"
	"time"

	"golang-todo/internal/config"
	"golang-todo/internal/libs/doranapi"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "user"

type Claims struct {
	Kodeku        string `json:"kodeku"` // = kode pegawai (stringified), lihat catatan desain
	Username      string `json:"username"`
	Fullname      string `json:"fullname"`
	PegawaiKode   int    `json:"pegawai_kode"`
	KodeDivisi    int    `json:"kode_divisi"`
	NamaDivisi    string `json:"nama_divisi"`
	AvatarURL     string `json:"avatar_url"`
	ExternalToken string `json:"ext_token"`
	jwt.RegisteredClaims
}

type Service struct {
	cfg      *config.Config
	doranAPI *doranapi.Client
}

func NewService(cfg *config.Config, doranAPI *doranapi.Client) *Service {
	return &Service{cfg: cfg, doranAPI: doranAPI}
}

func (s *Service) Login(ctx context.Context, username, password string) (string, error) {
	resp, err := s.doranAPI.Login(ctx, username, password)
	if err != nil {
		return "", errors.New("username atau password salah")
	}

	pegawaiKode, _ := strconv.Atoi(resp.LocalMasterPegawaiKode)
	divisiKode, _ := strconv.Atoi(resp.KodeDivisi)

	claims := Claims{
		Kodeku:        resp.LocalMasterPegawaiKode, // pakai kode pegawai, bukan resp.ID
		Username:      resp.Username,
		Fullname:      resp.Fullname,
		PegawaiKode:   pegawaiKode,
		KodeDivisi:    divisiKode,
		NamaDivisi:    resp.Divisi,
		AvatarURL:     resp.VvFotoProfile,
		ExternalToken: resp.XxApiToken,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func UserFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(UserContextKey).(*Claims)
	return claims, ok
}

func RequireUser(ctx context.Context) (*Claims, error) {
	claims, ok := UserFromContext(ctx)
	if !ok {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}
