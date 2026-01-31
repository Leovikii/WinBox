package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// TrafficMonitor monitors network traffic through Clash API WebSocket
type TrafficMonitor struct {
	ctx     context.Context
	running bool
	mu      sync.RWMutex
	conn    *websocket.Conn
	apiURL  string
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

	// Replace 0.0.0.0 with 127.0.0.1 for client connection
	wsURL := tm.apiURL
	if len(wsURL) > 14 && wsURL[:14] == "http://0.0.0.0" {
		wsURL = "http://127.0.0.1" + wsURL[14:]
	}

	// Convert http:// to ws://
	if len(wsURL) > 7 && wsURL[:7] == "http://" {
		wsURL = "ws://" + wsURL[7:]
	} else if len(wsURL) > 8 && wsURL[:8] == "https://" {
		wsURL = "wss://" + wsURL[8:]
	}
	wsURL = wsURL + "/traffic"

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

		conn, _, err := dialer.Dial(wsURL, nil)
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

		// Parse traffic data
		var data TrafficData
		if err := json.Unmarshal(message, &data); err != nil {
			continue
		}

		// Emit to frontend (data.Up and data.Down are already in bytes/second)
		wailsRuntime.EventsEmit(tm.ctx, "traffic-update", map[string]int64{
			"upload":   data.Up,
			"download": data.Down,
		})
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
