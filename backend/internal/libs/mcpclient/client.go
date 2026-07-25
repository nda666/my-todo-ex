package mcpclient

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"sync/atomic"
)

// Client adalah stdio JSON-RPC client minimal untuk MCP (Model Context Protocol) -
// cukup untuk kebutuhan tools/call di alur pptxgen, bukan implementasi spec MCP penuh.
type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  *bufio.Reader
	nextID  int64
	mu      sync.Mutex
	pending map[int64]chan rpcResponse
	pendMu  sync.Mutex
}

type rpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Start menjalankan proses MCP server (node) dan melakukan handshake "initialize".
func Start(ctx context.Context, nodeBin, serverScript string) (*Client, error) {
	cmd := exec.CommandContext(ctx, nodeBin, serverScript)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("gagal menjalankan MCP server pptxgen: %w", err)
	}

	c := &Client{cmd: cmd, stdin: stdin, stdout: bufio.NewReader(stdout), pending: make(map[int64]chan rpcResponse)}
	go c.readLoop()

	if _, err := c.call(ctx, "initialize", map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]interface{}{},
		"clientInfo":      map[string]string{"name": "doran-todo-backend", "version": "1.0.0"},
	}); err != nil {
		c.Close()
		return nil, fmt.Errorf("MCP initialize gagal: %w", err)
	}
	if err := c.notify("notifications/initialized", map[string]interface{}{}); err != nil {
		c.Close()
		return nil, err
	}

	return c, nil
}

func (c *Client) readLoop() {
	for {
		line, err := c.stdout.ReadBytes('\n')
		if len(line) > 0 {
			var resp rpcResponse
			if jsonErr := json.Unmarshal(line, &resp); jsonErr == nil && resp.ID != 0 {
				c.pendMu.Lock()
				if ch, ok := c.pending[resp.ID]; ok {
					ch <- resp
					delete(c.pending, resp.ID)
				}
				c.pendMu.Unlock()
			}
		}
		if err != nil {
			return
		}
	}
}

func (c *Client) call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	id := atomic.AddInt64(&c.nextID, 1)
	raw, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	if err != nil {
		return nil, err
	}

	ch := make(chan rpcResponse, 1)
	c.pendMu.Lock()
	c.pending[id] = ch
	c.pendMu.Unlock()

	c.mu.Lock()
	_, werr := c.stdin.Write(append(raw, '\n'))
	c.mu.Unlock()
	if werr != nil {
		return nil, werr
	}

	select {
	case resp := <-ch:
		if resp.Error != nil {
			return nil, fmt.Errorf("mcp error %d: %s", resp.Error.Code, resp.Error.Message)
		}
		return resp.Result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (c *Client) notify(method string, params interface{}) error {
	raw, err := json.Marshal(map[string]interface{}{"jsonrpc": "2.0", "method": method, "params": params})
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_, err = c.stdin.Write(append(raw, '\n'))
	return err
}

type toolCallResult struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	IsError bool `json:"isError"`
}

// CallTool memanggil satu tool MCP dan mengembalikan gabungan teks hasilnya.
func (c *Client) CallTool(ctx context.Context, name string, arguments json.RawMessage) (string, error) {
	raw, err := c.call(ctx, "tools/call", map[string]interface{}{"name": name, "arguments": arguments})
	if err != nil {
		return "", err
	}
	var result toolCallResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("gagal parse hasil tool %s: %w", name, err)
	}
	text := ""
	for _, item := range result.Content {
		text += item.Text
	}
	if result.IsError {
		return "", fmt.Errorf("tool %s error: %s", name, text)
	}
	return text, nil
}

func (c *Client) Close() error {
	_ = c.stdin.Close()
	if c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	return c.cmd.Wait()
}
