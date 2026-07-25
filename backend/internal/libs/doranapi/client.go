package doranapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
)

type Client struct {
	APIKey        string
	AuthBaseURL   string
	OfficeBaseURL string
	HTTP          *http.Client
}

func NewClient(apiKey, authBaseURL, officeBaseURL string) *Client {
	return &Client{APIKey: apiKey, AuthBaseURL: authBaseURL, OfficeBaseURL: officeBaseURL, HTTP: &http.Client{}}
}

type LoginResponse struct {
	ID                     string `json:"id"`
	Username               string `json:"username"`
	Fullname               string `json:"fullname"`
	LocalMasterPegawaiKode string `json:"local_masterpegawai_kode"`
	XxApiToken             string `json:"xx_api_token"`
	VvFotoProfile          string `json:"vv_foto_profile"`
	KodeDivisi             string `json:"kodedivisi"`
	Divisi                 string `json:"divisi"`
	Status                 bool   `json:"status"`
	Message                string `json:"message"`
}

func (c *Client) Login(ctx context.Context, username, password string) (*LoginResponse, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", username)
	writer.WriteField("password", password)
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.AuthBaseURL+"/login", body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("x-api-key", c.APIKey)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result LoginResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse login response: %w", err)
	}
	if !result.Status {
		msg := result.Message
		if msg == "" {
			msg = "login gagal"
		}
		return nil, fmt.Errorf(msg)
	}
	return &result, nil
}

type DivisiItem struct {
	Kode int    `json:"kode"`
	Nama string `json:"nama"`
}

type divisiResponse struct {
	Data []DivisiItem `json:"data"`
}

func (c *Client) GetDivisions(ctx context.Context, token string) ([]DivisiItem, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.OfficeBaseURL+"/divisi", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result divisiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Data, nil
}

type PegawaiItem struct {
	Kode         int    `json:"kode"`
	Nama         string `json:"nama"`
	KodeDivisi   int    `json:"kode_divisi"`
	NamaJabatan  string `json:"nama_jabatan"`
	KodeJabatan  int    `json:"kode_jabatan"`
	StatusLeader int    `json:"status_leader"`
}

type pegawaiResponse struct {
	Data []PegawaiItem `json:"data"`
	Meta struct {
		LastPage int `json:"last_page"`
	} `json:"meta"`
}

func (c *Client) GetAllPegawaiByDivisi(ctx context.Context, token string, kodeDivisi int) ([]PegawaiItem, error) {
	var all []PegawaiItem
	page := 1
	for {
		endpoint := fmt.Sprintf("%s/pegawai?%s", c.OfficeBaseURL, url.Values{
			"kodeDivisi": {fmt.Sprint(kodeDivisi)},
			"perPage":    {"100"},
			"page":       {fmt.Sprint(page)},
		}.Encode())

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := c.HTTP.Do(req)
		if err != nil {
			return nil, err
		}

		var result pegawaiResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, decodeErr
		}

		all = append(all, result.Data...)
		if page >= result.Meta.LastPage || result.Meta.LastPage == 0 {
			break
		}
		page++
	}
	return all, nil
}
