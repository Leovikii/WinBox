package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// HTTPClient provides HTTP operations with timeout and retry
type HTTPClient struct {
	client     *http.Client
	maxRetries int
	retryDelay time.Duration
}

// NewHTTPClient creates a new HTTP client with timeout settings
func NewHTTPClient() *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
		maxRetries: 3,
		retryDelay: 2 * time.Second,
	}
}

// Get performs HTTP GET with retry logic
func (hc *HTTPClient) Get(url string) (*http.Response, error) {
	var resp *http.Response
	var err error

	for i := 0; i < hc.maxRetries; i++ {
		req, reqErr := http.NewRequest("GET", url, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("User-Agent", "sing-box")
		resp, err = hc.client.Do(req)
		if err == nil && resp.StatusCode < 500 {
			return resp, nil
		}

		if resp != nil {
			resp.Body.Close()
		}

		if i < hc.maxRetries-1 {
			time.Sleep(hc.retryDelay)
		}
	}

	return nil, fmt.Errorf("failed after %d retries: %w", hc.maxRetries, err)
}

// Download downloads a file with progress tracking
func (hc *HTTPClient) Download(url, dest string, ctx context.Context) error {
	resp, err := hc.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	counter := &WriteCounter{
		Total:    uint64(resp.ContentLength),
		Current:  0,
		Ctx:      ctx,
		LastTime: time.Now(),
	}

	_, err = io.Copy(out, io.TeeReader(resp.Body, counter))
	return err
}

// GetLatestRelease fetches the latest release info from a github repo
func (hc *HTTPClient) GetLatestRelease(repoURL string, allowPreRelease bool) (*ReleaseInfo, error) {
	apiURL := repoURL + "/releases/latest"
	if allowPreRelease {
		apiURL = repoURL + "/releases" // fetch all releases to find the newest including prereleases
	}

	resp, err := hc.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if allowPreRelease {
		var resList []ReleaseInfo
		if err := json.NewDecoder(resp.Body).Decode(&resList); err != nil {
			return nil, fmt.Errorf("parse error: %w", err)
		}
		if len(resList) == 0 {
			return nil, fmt.Errorf("no releases found")
		}
		return &resList[0], nil
	} else {
		var res ReleaseInfo
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return nil, fmt.Errorf("parse error: %w", err)
		}
		return &res, nil
	}
}

// CheckUpdate checks for the latest sing-box release
func (hc *HTTPClient) CheckUpdate(preRelease bool) (string, error) {
	res, err := hc.GetLatestRelease("https://api.github.com/repos/SagerNet/sing-box", preRelease)
	if err != nil {
		return "", err
	}

	if res.TagName == "" {
		return "", fmt.Errorf("no tag found")
	}

	return res.TagName, nil
}
