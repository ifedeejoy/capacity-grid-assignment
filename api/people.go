package main

import (
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

// maxWeeklyHours is the hard ceiling: there are 168 hours in a week.
const maxWeeklyHours = 168

type updatePersonRequest struct {
	WeeklyHours *float64 `json:"weeklyHours"`
}

// personResponse is the wire shape for a person. It deliberately carries no
// allocations: weekly hours only feed capacity, so a client that already
// holds allocations can apply this to its local row and be correct.
type personResponse struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weeklyHours"`
}

// handleUpdatePerson serves PATCH /api/people/{id} with body {"weeklyHours": n}.
//
// Returns the person as stored, which is what the grid should display. The
// value is echoed back rather than assumed so any future server-side
// normalisation (rounding, clamping) reaches the screen.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "person id must be a positive integer")
		return
	}

	var req updatePersonRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "body must be JSON like {\"weeklyHours\": 32}")
		return
	}
	if req.WeeklyHours == nil {
		writeError(w, http.StatusBadRequest, "weeklyHours is required")
		return
	}
	hours := *req.WeeklyHours
	if math.IsNaN(hours) || math.IsInf(hours, 0) || hours < 0 || hours > maxWeeklyHours {
		writeError(w, http.StatusBadRequest, "weeklyHours must be between 0 and 168")
		return
	}

	var p personResponse
	err = s.db.QueryRow(r.Context(),
		`UPDATE people SET weekly_hours = $1 WHERE id = $2 RETURNING id, name, weekly_hours`,
		hours, id,
	).Scan(&p.ID, &p.Name, &p.WeeklyHours)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, "no such person")
		return
	case err != nil:
		log.Printf("update person %d: %v", id, err)
		writeError(w, http.StatusInternalServerError, "could not update person")
		return
	}

	writeJSON(w, http.StatusOK, p)
}
