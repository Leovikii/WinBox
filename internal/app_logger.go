package internal

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// LogLevel represents log severity levels
type LogLevel int

const (
	LogLevelInfo LogLevel = iota
	LogLevelWarn
	LogLevelError
)

// AppLogger manages application logging
type AppLogger struct {
	mu       sync.Mutex
	logPath  string
	maxSize  int64 // Maximum log file size in bytes (10MB)
	maxFiles int   // Maximum number of archived log files
}

// NewAppLogger creates a new application logger
func NewAppLogger(appDir string) *AppLogger {
	logPath := filepath.Join(appDir, "data", "app.log")
	return &AppLogger{
		logPath:  logPath,
		maxSize:  10 * 1024 * 1024, // 10MB
		maxFiles: 5,
	}
}

// log writes a log entry with the specified level
func (al *AppLogger) log(level LogLevel, message string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	// Check if rotation is needed
	al.rotateIfNeeded()

	// Format log entry
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	levelStr := al.levelToString(level)
	logEntry := fmt.Sprintf("[%s] [%s] %s\n", timestamp, levelStr, message)

	// Ensure directory exists
	os.MkdirAll(filepath.Dir(al.logPath), 0755)

	// Append to log file
	f, err := os.OpenFile(al.logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	f.WriteString(logEntry)
}

// Info logs an informational message
func (al *AppLogger) Info(message string) {
	al.log(LogLevelInfo, message)
}

// Warn logs a warning message
func (al *AppLogger) Warn(message string) {
	al.log(LogLevelWarn, message)
}

// Error logs an error message
func (al *AppLogger) Error(message string) {
	al.log(LogLevelError, message)
}

// levelToString converts log level to string
func (al *AppLogger) levelToString(level LogLevel) string {
	switch level {
	case LogLevelInfo:
		return "INFO"
	case LogLevelWarn:
		return "WARN"
	case LogLevelError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// rotateIfNeeded rotates log files if the current file exceeds maxSize
func (al *AppLogger) rotateIfNeeded() {
	info, err := os.Stat(al.logPath)
	if err != nil || info.Size() < al.maxSize {
		return
	}

	// Rotate existing archives
	for i := al.maxFiles - 1; i > 0; i-- {
		oldPath := fmt.Sprintf("%s.%d", al.logPath, i)
		newPath := fmt.Sprintf("%s.%d", al.logPath, i+1)
		os.Rename(oldPath, newPath)
	}

	// Move current log to .1
	archivePath := fmt.Sprintf("%s.1", al.logPath)
	os.Rename(al.logPath, archivePath)
}

// GetLogs reads and returns the log file content
func (al *AppLogger) GetLogs() string {
	al.mu.Lock()
	defer al.mu.Unlock()

	content, err := os.ReadFile(al.logPath)
	if err != nil {
		return "> No app log file available"
	}

	return string(content)
}

// Clear clears the log file
func (al *AppLogger) Clear() error {
	al.mu.Lock()
	defer al.mu.Unlock()

	return os.WriteFile(al.logPath, []byte(""), 0644)
}
