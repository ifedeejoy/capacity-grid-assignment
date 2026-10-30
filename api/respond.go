package main

import "net/http"

// writeError sends a JSON error body so the client can show a message
// without sniffing content types. Internal details stay in the server log.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
