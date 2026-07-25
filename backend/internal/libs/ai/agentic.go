// backend/internal/libs/ai/agentic.go — full file
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

type ToolDef struct {
	Name        string
	Description string
	Parameters  json.RawMessage
}

type ToolExecutor func(ctx context.Context, name string, argumentsJSON string) (string, error)

type AgenticClient struct {
	baseURL string
	apiKey  string
	model   string
	http    *http.Client
}

func NewAgenticNimClient(apiKey, model string) *AgenticClient {
	return &AgenticClient{baseURL: "https://integrate.api.nvidia.com/v1", apiKey: apiKey, model: model, http: &http.Client{}}
}

func NewAgenticOpenRouterClient(apiKey, model string) *AgenticClient {
	return &AgenticClient{baseURL: "https://openrouter.ai/api/v1", apiKey: apiKey, model: model, http: &http.Client{}}
}

func NewAgenticGeminiClient(apiKey, model string) *AgenticClient {
	return &AgenticClient{baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: apiKey, model: model, http: &http.Client{}}
}

type agenticToolRef struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function agenticToolRefFunc `json:"function"`
}

type agenticToolRefFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type agenticTool struct {
	Type     string              `json:"type"`
	Function agenticToolFunction `json:"function"`
}

type agenticToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type agenticRequest struct {
	Model    string            `json:"model"`
	Messages []json.RawMessage `json:"messages"`
	Tools    []agenticTool     `json:"tools,omitempty"`
}

type minimalMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	ToolCalls []agenticToolRef `json:"tool_calls"`
}

type rawChoice struct {
	Message json.RawMessage `json:"message"`
}

type agenticResponse struct {
	Choices []rawChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func toAgenticTools(tools []ToolDef) []agenticTool {
	result := make([]agenticTool, len(tools))
	for i, t := range tools {
		result[i] = agenticTool{Type: "function", Function: agenticToolFunction{Name: t.Name, Description: t.Description, Parameters: t.Parameters}}
	}
	return result
}

func mustMarshal(v interface{}) json.RawMessage {
	raw, _ := json.Marshal(v)
	return raw
}

// rateLimitError menandai error 429 supaya RunAgentLoop tahu harus nunggu & retry,
// bukan langsung menyerah. retryAfter diambil dari pesan error kalau providernya
// menyertakan saran durasi (Gemini biasa kasih "Please retry in Xs").
type rateLimitError struct {
	retryAfter time.Duration
}

func (e *rateLimitError) Error() string {
	return fmt.Sprintf("rate limited, retry after %s", e.retryAfter)
}

var retryAfterRegex = regexp.MustCompile(`retry in (\d+(\.\d+)?)s`)

func parseRetryAfter(msg string) time.Duration {
	m := retryAfterRegex.FindStringSubmatch(msg)
	if len(m) < 2 {
		return 20 * time.Second // fallback kalau providernya tidak kasih saran durasi
	}
	secs, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 20 * time.Second
	}
	return time.Duration(secs*1000)*time.Millisecond + 2*time.Second // +buffer kecil
}

func (c *AgenticClient) step(ctx context.Context, messages []json.RawMessage, tools []agenticTool) (json.RawMessage, minimalMessage, error) {
	log.Printf("[AI-Agentic] step — model=%s messages=%d tools=%d", c.model, len(messages), len(tools))

	payload, err := json.Marshal(agenticRequest{Model: c.model, Messages: messages, Tools: tools})
	if err != nil {
		return nil, minimalMessage{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, minimalMessage{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	log.Printf("[AI-Agentic] step — sending request to %s/chat/completions", c.baseURL)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, minimalMessage{}, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, minimalMessage{}, err
	}

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
			e := arrErrors[0].Error
			log.Printf("[AI-Agentic] step ERROR array error: code=%d status=%s message=%s", e.Code, e.Status, e.Message)
			if e.Code == 429 || e.Status == "RESOURCE_EXHAUSTED" {
				return nil, minimalMessage{}, &rateLimitError{retryAfter: parseRetryAfter(e.Message)}
			}
			return nil, minimalMessage{}, fmt.Errorf("ai provider error (%d %s): %s", e.Code, e.Status, e.Message)
		}
		return nil, minimalMessage{}, fmt.Errorf("ai provider mengembalikan bentuk respons tak terduga (status %d): %s", resp.StatusCode, string(trimmed))
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		log.Printf("[AI-Agentic] step ERROR http 429: %s", string(trimmed))
		return nil, minimalMessage{}, &rateLimitError{retryAfter: parseRetryAfter(string(trimmed))}
	}
	if resp.StatusCode >= 400 {
		log.Printf("[AI-Agentic] step ERROR http %d: %s", resp.StatusCode, string(trimmed))
		return nil, minimalMessage{}, fmt.Errorf("ai provider http %d: %s", resp.StatusCode, string(trimmed))
	}

	var result agenticResponse
	if err := json.Unmarshal(trimmed, &result); err != nil {
		return nil, minimalMessage{}, fmt.Errorf("gagal parse respons ai provider: %w (body: %s)", err, string(trimmed))
	}
	if result.Error != nil {
		return nil, minimalMessage{}, fmt.Errorf("ai provider error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return nil, minimalMessage{}, fmt.Errorf("ai provider returned no choices")
	}

	rawMsg := result.Choices[0].Message
	var parsed minimalMessage
	if err := json.Unmarshal(rawMsg, &parsed); err != nil {
		return nil, minimalMessage{}, fmt.Errorf("gagal parse message: %w", err)
	}

	// Log response AI — content + tool_calls
	if parsed.Content != "" {
		log.Printf("[AI-Agentic] step RESPONSE — model=%s content=%q", c.model, parsed.Content)
	} else {
		log.Printf("[AI-Agentic] step RESPONSE — model=%s content=<empty>", c.model)
	}
	if len(parsed.ToolCalls) > 0 {
		for _, tc := range parsed.ToolCalls {
			log.Printf("[AI-Agentic] step TOOL_CALL — id=%s name=%s arguments=%s", tc.ID, tc.Function.Name, tc.Function.Arguments)
		}
	} else {
		log.Printf("[AI-Agentic] step NO_TOOL_CALLS — model=%s", c.model)
	}

	return rawMsg, parsed, nil
}

// stepWithRetry membungkus step() dengan retry otomatis khusus untuk rate-limit (429) -
// nunggu sesuai saran provider (atau fallback), maksimal maxRetries kali, supaya loop
// panjang (banyak elemen slide) tidak langsung gagal total gara-gara limit per-menit.
func (c *AgenticClient) stepWithRetry(ctx context.Context, messages []json.RawMessage, tools []agenticTool, maxRetries int) (json.RawMessage, minimalMessage, error) {
	for attempt := 0; ; attempt++ {
		rawMsg, parsed, err := c.step(ctx, messages, tools)
		if err == nil {
			return rawMsg, parsed, nil
		}
		rle, ok := err.(*rateLimitError)
		if !ok || attempt >= maxRetries {
			return nil, minimalMessage{}, err
		}
		log.Printf("[AI-Agentic] rate limited — menunggu %s sebelum retry (percobaan %d/%d)", rle.retryAfter, attempt+1, maxRetries)
		select {
		case <-time.After(rle.retryAfter):
		case <-ctx.Done():
			return nil, minimalMessage{}, ctx.Err()
		}
	}
}

// RunAgentLoop menjalankan percakapan tool-calling sampai model memanggil tool bernama
// stopToolName tanpa error. Kena rate-limit (429) -> TUNGGU & retry otomatis (lewat
// stepWithRetry), bukan langsung dianggap gagal.
func (c *AgenticClient) RunAgentLoop(ctx context.Context, systemPrompt, userPrompt string, tools []ToolDef, exec ToolExecutor, stopToolName string, maxSteps int) (string, error) {
	const windowSize = 4
	const maxRateLimitRetries = 6 // total toleransi nunggu ~beberapa menit sebelum benar2 menyerah

	agenticTools := toAgenticTools(tools)
	messages := []json.RawMessage{
		mustMarshal(map[string]string{"role": "system", "content": systemPrompt}),
		mustMarshal(map[string]string{"role": "user", "content": userPrompt}),
	}
	var toolMsgIndexes []int

	for step := 0; step < maxSteps; step++ {
		log.Printf("[AI-Agentic] RunAgentLoop — step=%d/%d messages=%d", step+1, maxSteps, len(messages))
		rawReply, parsed, err := c.stepWithRetry(ctx, messages, agenticTools, maxRateLimitRetries)
		if err != nil {
			return "", err
		}

		if len(parsed.ToolCalls) == 0 {
			log.Printf("[AI-Agentic] RunAgentLoop — step=%d model berhenti tanpa tool calls, content=%q", step+1, parsed.Content)
			return "", fmt.Errorf("model berhenti tanpa menyelesaikan presentasi (respons: %s)", parsed.Content)
		}

		messages = append(messages, rawReply)
		log.Printf("[AI-Agentic] RunAgentLoop — step=%d tool_calls=%d diproses", step+1, len(parsed.ToolCalls))

		for _, tc := range parsed.ToolCalls {
			result, execErr := exec(ctx, tc.Function.Name, tc.Function.Arguments)
			if execErr != nil {
				result = fmt.Sprintf(`{"error":%q}`, execErr.Error())
			}
			messages = append(messages, mustMarshal(map[string]string{
				"role":         "tool",
				"tool_call_id": tc.ID,
				"content":      result,
			}))
			toolMsgIndexes = append(toolMsgIndexes, len(messages)-1)

			if tc.Function.Name == stopToolName && execErr == nil {
				return result, nil
			}
		}

		if len(toolMsgIndexes) > windowSize {
			for _, idx := range toolMsgIndexes[:len(toolMsgIndexes)-windowSize] {
				var m map[string]interface{}
				if json.Unmarshal(messages[idx], &m) == nil {
					m["content"] = "ok (ringkas)"
					messages[idx] = mustMarshal(m)
				}
			}
		}
	}

	return "", fmt.Errorf("melebihi batas %d langkah tanpa menyelesaikan presentasi", maxSteps)
}
