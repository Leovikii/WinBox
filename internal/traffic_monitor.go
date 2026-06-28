package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// TrafficMonitor monitors network traffic through Clash API WebSocket
type TrafficMonitor struct {
	ctx     context.Context
	running   bool
	ipcPaused bool
	mu        sync.RWMutex
	conn      *websocket.Conn
	apiURL    string
}

// TrafficData represents the traffic statistics from WebSocket
type TrafficData struct {
	Up   int64 `json:"up"`
	Down int64 `json:"down"`
}

// NewTrafficMonitor creates a new traffic monitor
func NewTrafficMonitor(ctx context.Context, apiURL string) *TrafficMonitor {
	return &TrafficMonitor{
		ctx:    ctx,
		apiURL: apiURL,
	}
}

// Start starts the traffic monitoring via WebSocket
func (tm *TrafficMonitor) Start() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if tm.running {
		return fmt.Errorf("traffic monitor already running")
	}

	// Parse and construct WebSocket URL safely
	wsURL := tm.apiURL
	wsURL = strings.Replace(wsURL, "http://0.0.0.0", "http://127.0.0.1", 1)
	wsURL = strings.Replace(wsURL, "https://0.0.0.0", "https://127.0.0.1", 1)
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	wsURL = strings.TrimSuffix(wsURL, "/") + "/traffic"

	// Mark as running before starting goroutine to avoid race
	tm.running = true

	// Start connection in background with delay to let core fully start
	go func() {
		// Wait for core to fully start
		time.Sleep(2 * time.Second)

		// Connect to WebSocket
		dialer := websocket.Dialer{
			HandshakeTimeout: 5 * time.Second,
		}

		var conn *websocket.Conn
		var err error

		// Retry connection up to 5 times
		for i := 0; i < 5; i++ {
			tm.mu.RLock()
			running := tm.running
			tm.mu.RUnlock()
			if !running {
				return
			}

			conn, _, err = dialer.Dial(wsURL, nil)
			if err == nil {
				break
			}
			time.Sleep(1 * time.Second)
		}

		if err != nil {
			tm.mu.Lock()
			tm.running = false
			tm.mu.Unlock()
			return
		}

		tm.mu.Lock()
		tm.conn = conn
		tm.mu.Unlock()

		// Start reading messages
		tm.readLoop()
	}()

	return nil
}

// Stop stops the traffic monitoring
func (tm *TrafficMonitor) Stop() {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if !tm.running {
		return
	}

	tm.running = false

	if tm.conn != nil {
		tm.conn.Close()
		tm.conn = nil
	}

	// Emit zero speed when stopped
	wailsRuntime.EventsEmit(tm.ctx, "traffic-update", map[string]int64{
		"upload":   0,
		"download": 0,
	})
}

// IsRunning returns whether the monitor is running
func (tm *TrafficMonitor) IsRunning() bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.running
}

// SetIPCPaused pauses or resumes IPC event emission
func (tm *TrafficMonitor) SetIPCPaused(paused bool) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.ipcPaused = paused
}

// readLoop continuously reads messages from WebSocket
func (tm *TrafficMonitor) readLoop() {
	for {
		tm.mu.RLock()
		running := tm.running
		conn := tm.conn
		tm.mu.RUnlock()

		if !running || conn == nil {
			break
		}

		// Read message from WebSocket
		_, message, err := conn.ReadMessage()
		if err != nil {
			// Connection closed or error, emit zero and stop
			wailsRuntime.EventsEmit(tm.ctx, "traffic-update", map[string]int64{
				"upload":   0,
				"download": 0,
			})
			break
		}

		// Only parse and emit if frontend is visible
		tm.mu.RLock()
		paused := tm.ipcPaused
		tm.mu.RUnlock()

		if !paused {
			var data TrafficData
			if err := json.Unmarshal(message, &data); err == nil {
				wailsRuntime.EventsEmit(tm.ctx, "traffic-update", map[string]int64{
					"upload":   data.Up,
					"download": data.Down,
				})
			}
		}
	}

	// Clean up
	tm.mu.Lock()
	tm.running = false
	if tm.conn != nil {
		tm.conn.Close()
		tm.conn = nil
	}
	tm.mu.Unlock()
}
