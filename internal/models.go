package internal

import (
	"context"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const DefaultTunConfig = `{"type":"tun","tag":"tun-in","address":["172.19.0.1/30","fdfe:dcba:9876::1/126"],"mtu":9000,"auto_route":true,"strict_route":true}`
const DefaultMixedConfig = `{"type":"mixed","tag":"mixed-in","listen":"0.0.0.0","listen_port":7893,"set_system_proxy":true}`

// Profile represents a configuration profile
type Profile struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Url     string `json:"url"`
	Path    string `json:"path"`
	Updated string `json:"updated"`
}

// MetaData represents the application metadata
type MetaData struct {
	ActiveID        string    `json:"active_id"`
	Mirror          string    `json:"mirror"`
	MirrorEnabled   bool      `json:"mirror_enabled"`
	TunMode         bool      `json:"tun_mode"`
	SysProxy        bool      `json:"sys_proxy"`
	TunConfig       string    `json:"tun_config"`
	MixedConfig     string    `json:"mixed_config"`
	AutoConnect     bool      `json:"auto_connect"`
	AutoConnectMode string    `json:"auto_connect_mode"`
	StartOnBoot     bool      `json:"start_on_boot"`
	Profiles        []Profile `json:"profiles"`
}

// ReleaseAsset represents a GitHub release asset
type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadUrl string `json:"browser_download_url"`
}

// ReleaseInfo represents GitHub release information
type ReleaseInfo struct {
	TagName string         `json:"tag_name"`
	Assets  []ReleaseAsset `json:"assets"`
}

// WriteCounter tracks download progress
type WriteCounter struct {
	Total    uint64
	Current  uint64
	Ctx      context.Context
	LastTime time.Time
}

// Write implements io.Writer interface for progress tracking
func (wc *WriteCounter) Write(p []byte) (int, error) {
	n := len(p)
	wc.Current += uint64(n)

	if wc.Total > 0 {
		if time.Since(wc.LastTime) > 100*time.Millisecond || wc.Current == wc.Total {
			percentage := float64(wc.Current) / float64(wc.Total) * 100
			wailsRuntime.EventsEmit(wc.Ctx, "download-progress", int(percentage))
			wc.LastTime = time.Now()
		}
	}
	return n, nil
}
