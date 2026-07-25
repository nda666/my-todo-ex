// backend/internal/libs/ai/client.go
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client interface {
	Complete(ctx context.Context, messages []ChatMessage, sessionId string) (string, error)
}

// openAICompatClient adalah client generik untuk API yang mengikuti format OpenAI
// chat completions (dipakai NVIDIA NIM, OpenRouter, dan Gemini lewat endpoint
// OpenAI-compatible-nya Google).
type openAICompatClient struct {
	baseURL string
	apiKey  string
	model   string
	http    *http.Client
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	User     string        `json:"user,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Complete mengirim request chat completion. sessionId diteruskan lewat field "user" -
// dipakai provider (OpenRouter/Gemini) untuk pengelompokan rate-limit & prompt caching
// per sesi, bukan untuk logika bisnis di sisi kita.
func (c *openAICompatClient) Complete(ctx context.Context, messages []ChatMessage, sessionId string) (string, error) {
	log.Printf("[AI-Client] Complete called — model=%s sessionId=%s messages=%d", c.model, sessionId, len(messages))

	payload, err := json.Marshal(chatRequest{Model: c.model, Messages: messages, User: sessionId})
	if err != nil {
		log.Printf("[AI-Client] ERROR marshal request: %v", err)
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		log.Printf("[AI-Client] ERROR creating request: %v", err)
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	log.Printf("[AI-Client] Sending request to %s/chat/completions", c.baseURL)
	resp, err := c.http.Do(req)
	if err != nil {
		log.Printf("[AI-Client] ERROR http request: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[AI-Client] ERROR read response body: %v", err)
		return "", err
	}

	// Gemini (dan sebagian provider lain) membalas error dalam bentuk ARRAY
	// [{"error":{"code":...,"message":"..."}}], bukan objek chatResponse biasa.
	// Deteksi dulu supaya error asli (kuota/model salah/dll) kelihatan jelas di log,
	// bukan cuma "cannot unmarshal array".
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var arrErrors []struct {
			Error struct {
				Message string `json:"message"`
				Code    int    `json:"code"`
				Status  string `json:"status"`
			} `json:"error"`
		}
		if jsonErr := json.Unmarshal(trimmed, &arrErrors); jsonErr == nil && len(arrErrors) > 0 && arrErrors[0].Error.Message != "" {
			log.Printf("[AI-Client] ERROR provider returned array error: code=%d status=%s message=%s", arrErrors[0].Error.Code, arrErrors[0].Error.Status, arrErrors[0].Error.Message)
			return "", fmt.Errorf("ai provider error (%d %s): %s", arrErrors[0].Error.Code, arrErrors[0].Error.Status, arrErrors[0].Error.Message)
		}
		log.Printf("[AI-Client] ERROR unexpected array response (status %d): %s", resp.StatusCode, string(trimmed))
		return "", fmt.Errorf("ai provider mengembalikan bentuk respons tak terduga (status %d): %s", resp.StatusCode, string(trimmed))
	}

	if resp.StatusCode >= 400 {
		log.Printf("[AI-Client] ERROR http status %d: %s", resp.StatusCode, string(trimmed))
		return "", fmt.Errorf("ai provider http %d: %s", resp.StatusCode, string(trimmed))
	}

	var result chatResponse
	if err := json.Unmarshal(trimmed, &result); err != nil {
		log.Printf("[AI-Client] ERROR decode response: %v (body: %s)", err, string(trimmed))
		return "", err
	}
	if result.Error != nil {
		log.Printf("[AI-Client] ERROR provider returned error: %s", result.Error.Message)
		return "", fmt.Errorf("ai provider error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		log.Printf("[AI-Client] ERROR no choices in response — model=%s", c.model)
		return "", fmt.Errorf("ai provider returned no choices")
	}

	reply := result.Choices[0].Message.Content
	if len(reply) > 200 {
		log.Printf("[AI-Client] SUCCESS — model=%s sessionId=%s reply_length=%d preview=%.200s...", c.model, sessionId, len(reply), reply)
	} else {
		log.Printf("[AI-Client] SUCCESS — model=%s sessionId=%s reply=%s", c.model, sessionId, reply)
	}
	return reply, nil
}

func NewNimClient(apiKey, model string) Client {
	log.Printf("[AI-Client] NewNimClient — model=%s", model)
	return &openAICompatClient{
		baseURL: "https://integrate.api.nvidia.com/v1",
		apiKey:  apiKey,
		model:   model,
		http:    &http.Client{},
	}
}

func NewOpenRouterClient(apiKey, model string) Client {
	log.Printf("[AI-Client] NewOpenRouterClient — model=%s", model)
	return &openAICompatClient{
		baseURL: "https://openrouter.ai/api/v1",
		apiKey:  apiKey,
		model:   model,
		http:    &http.Client{},
	}
}

// NewGeminiClient pakai endpoint OpenAI-compatible resmi dari Google, jadi bisa
// reuse openAICompatClient yang sama tanpa perlu format request/response terpisah.
func NewGeminiClient(apiKey, model string) Client {
	log.Printf("[AI-Client] NewGeminiClient — model=%s", model)
	return &openAICompatClient{
		baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
		apiKey:  apiKey,
		model:   model,
		http:    &http.Client{},
	}
}

// FallbackClient mencoba daftar provider berurutan, berhenti di yang pertama berhasil.
// Providers[0] = utama, sisanya dicoba berurutan kalau yang sebelumnya gagal.
type FallbackClient struct {
	Providers []Client
}

func (f *FallbackClient) Complete(ctx context.Context, messages []ChatMessage, sessionId string) (string, error) {
	log.Printf("[AI-Client] FallbackClient.Complete — providers=%d sessionId=%s messages=%d", len(f.Providers), sessionId, len(messages))
	var lastErr error
	for i, p := range f.Providers {
		if p == nil {
			log.Printf("[AI-Client] FallbackClient — provider[%d] is nil, skipping", i)
			continue
		}
		log.Printf("[AI-Client] FallbackClient — trying provider[%d]", i)
		reply, err := p.Complete(ctx, messages, sessionId)
		if err == nil {
			log.Printf("[AI-Client] FallbackClient — provider[%d] succeeded", i)
			return reply, nil
		}
		log.Printf("[AI-Client] FallbackClient — provider[%d] failed: %v", i, err)
		lastErr = err
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("tidak ada AI provider yang dikonfigurasi")
		log.Printf("[AI-Client] FallbackClient — no providers configured")
	} else {
		log.Printf("[AI-Client] FallbackClient — all providers failed, last error: %v", lastErr)
	}
	return "", lastErr
}
