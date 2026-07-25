// backend/internal/config/config.go
package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBConnection       string
	DBHost             string
	DBPort             string
	DBDatabase         string
	DBUsername         string
	DBPassword         string
	JWTSecret          string
	ServerPort         string
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
		DBConnection:       getEnv("DB_CONNECTION", "mysql"),
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "3306"),
		DBDatabase:         getEnv("DB_DATABASE", ""),
		DBUsername:         getEnv("DB_USERNAME", ""),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		JWTSecret:          getEnv("JWT_SECRET", "dev-secret"),
		ServerPort:         getEnv("SERVER_PORT", "8080"),
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

	if cfg.DBDatabase == "" {
		return nil, fmt.Errorf("DB_DATABASE is required")
	}

	return cfg, nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.DBUsername, c.DBPassword, c.DBHost, c.DBPort, c.DBDatabase)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
