package auth

import (
	"context"
	"testing"
	"time"

	"golang-todo/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

func TestParseToken(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key-123",
	}
	svc := NewService(cfg, nil)

	t.Run("valid token", func(t *testing.T) {
		claims := Claims{
			Kodeku:      "PEG-100",
			Username:    "budi",
			Fullname:    "Budi Santoso",
			PegawaiKode: 100,
			KodeDivisi:  5,
			NamaDivisi:  "IT",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, err := token.SignedString([]byte(cfg.JWTSecret))
		if err != nil {
			t.Fatalf("failed to sign token: %v", err)
		}

		parsed, err := svc.ParseToken(tokenStr)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if parsed.Kodeku != "PEG-100" {
			t.Errorf("expected Kodeku 'PEG-100', got '%s'", parsed.Kodeku)
		}
		if parsed.Username != "budi" {
			t.Errorf("expected Username 'budi', got '%s'", parsed.Username)
		}
		if parsed.KodeDivisi != 5 {
			t.Errorf("expected KodeDivisi 5, got %d", parsed.KodeDivisi)
		}
	})

	t.Run("invalid token secret", func(t *testing.T) {
		claims := Claims{
			Kodeku: "PEG-100",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, _ := token.SignedString([]byte("wrong-secret"))

		_, err := svc.ParseToken(tokenStr)
		if err == nil {
			t.Error("expected error for token signed with wrong secret, got nil")
		}
	})

	t.Run("malformed token string", func(t *testing.T) {
		_, err := svc.ParseToken("not.a.valid.jwt")
		if err == nil {
			t.Error("expected error for malformed token string, got nil")
		}
	})
}

func TestContextHelpers(t *testing.T) {
	claims := &Claims{
		Kodeku:      "PEG-200",
		Username:    "siti",
		PegawaiKode: 200,
		KodeDivisi:  3,
	}

	t.Run("UserFromContext success", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), UserContextKey, claims)

		user, ok := UserFromContext(ctx)
		if !ok || user == nil {
			t.Fatalf("expected user claims from context, got ok=%v", ok)
		}
		if user.Kodeku != "PEG-200" {
			t.Errorf("expected Kodeku 'PEG-200', got '%s'", user.Kodeku)
		}
	})

	t.Run("UserFromContext missing key", func(t *testing.T) {
		ctx := context.Background()
		user, ok := UserFromContext(ctx)
		if ok || user != nil {
			t.Errorf("expected ok=false and nil user, got ok=%v, user=%v", ok, user)
		}
	})

	t.Run("RequireUser success", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), UserContextKey, claims)

		user, err := RequireUser(ctx)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if user.Username != "siti" {
			t.Errorf("expected Username 'siti', got '%s'", user.Username)
		}
	})

	t.Run("RequireUser unauthorized when missing context", func(t *testing.T) {
		ctx := context.Background()
		_, err := RequireUser(ctx)
		if err == nil {
			t.Error("expected unauthorized error, got nil")
		}
	})
}
