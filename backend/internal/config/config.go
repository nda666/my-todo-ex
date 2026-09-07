// backend/internal/config/config.go
package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBDSN              string
	DBConnection       string
	DBHost             string
	DBPort             string
	DBDatabase         string
	DBUsername         string
	DBPassword         string
	JWTSecret          string
	ServerPort         string
	CorsAllowedOrigins string
	DoranAPIKey        string
	DoranAuthBaseURL   string
	DoranOfficeBaseURL string
	NimAPIKey          string
	NimModel           string
	OpenRouterAPIKey   string
	OpenRouterModel    string
	GeminiAPIKey       string // <-- baru
	GeminiModel        string // <-- baru
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		DBDSN:              getEnv("DB_DSN", getEnv("DATABASE_URL", "")),
		DBConnection:       getEnv("DB_CONNECTION", "mysql"),
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "3306"),
		DBDatabase:         getEnv("DB_DATABASE", ""),
		DBUsername:         getEnv("DB_USERNAME", ""),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		JWTSecret:          getEnv("JWT_SECRET", "dev-secret"),
		ServerPort:         getEnv("PORT", getEnv("SERVER_PORT", "8000")),
		CorsAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", ""),
		NimAPIKey:          getEnv("NVIDIA_NIM_API_KEY", ""),
		NimModel:           getEnv("NVIDIA_NIM_MODEL", ""),
		OpenRouterAPIKey:   getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:    getEnv("OPENROUTER_MODEL", ""),
		GeminiAPIKey:       getEnv("GEMINI_API_KEY", ""),
		GeminiModel:        getEnv("GEMINI_MODEL", "gemini-2.0-flash"),
		DoranAPIKey:        getEnv("DORAN_API_KEY", "doran_data"),
		DoranAuthBaseURL:   getEnv("DORAN_AUTH_BASE_URL", "https://api.doran.id/api/doranbackend"),
		DoranOfficeBaseURL: getEnv("DORAN_OFFICE_BASE_URL", "https://jeoffice.doran.id/api"),
	}

	if cfg.DBDSN == "" && cfg.DBDatabase == "" {
		return nil, fmt.Errorf("DB_DATABASE or DB_DSN is required")
	}

	return cfg, nil
}

func (c *Config) DSN() string {
	if c.DBDSN != "" {
		return normalizeDSN(c.DBDSN)
	}

	tlsParam := ""
	if os.Getenv("DB_TLS") == "true" || c.DBPort == "4000" {
		tlsParam = "&tls=true"
	}

	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local%s",
		c.DBUsername, c.DBPassword, c.DBHost, c.DBPort, c.DBDatabase, tlsParam)
}

func normalizeDSN(raw string) string {
	if !strings.HasPrefix(raw, "mysql://") {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	user := u.User.Username()
	pass, _ := u.User.Password()
	host := u.Host
	db := strings.TrimPrefix(u.Path, "/")
	if db == "" {
		db = "test"
	}

	q := u.Query()
	if !q.Has("charset") {
		q.Set("charset", "utf8mb4")
	}
	if !q.Has("parseTime") {
		q.Set("parseTime", "True")
	}
	if !q.Has("loc") {
		q.Set("loc", "Local")
	}
	if !q.Has("tls") {
		q.Set("tls", "true")
	}

	if pass != "" {
		return fmt.Sprintf("%s:%s@tcp(%s)/%s?%s", user, pass, host, db, q.Encode())
	}
	return fmt.Sprintf("%s@tcp(%s)/%s?%s", user, host, db, q.Encode())
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
