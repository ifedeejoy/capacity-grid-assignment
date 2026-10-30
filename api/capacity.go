package main

import (
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"time"
)

// maxWeeks bounds a single request. Production serves up to two years of
// history; a wider window is almost certainly a client bug, not a real need.
const maxWeeks = 110

const dateLayout = "2006-01-02"

// capacityResponse is the wire shape for GET /api/capacity.
//
// Allocated is columnar: People[i].Allocated[j] is the hours person i has
// allocated in week Weeks[j]. Dense arrays keep the payload small for a large
// roster and make the grid a direct index, not a lookup.
type capacityResponse struct {
	From   string        `json:"from"`
	To     string        `json:"to"`
	Weeks  []string      `json:"weeks"`
	People []capacityRow `json:"people"`
}

type capacityRow struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	WeeklyHours float64   `json:"weeklyHours"`
	Allocated   []float64 `json:"allocated"`
}

// capacityQuery sums allocated hours per person per week.
//
// Weeks run Monday–Sunday but only Monday–Friday earns hours: weekly_hours is a
// working-week number, so an assignment that ends on a Sunday contributes five
// days, not seven. The overlap is closed-form (clamp the assignment to the
// week's Mon–Fri, count the days), so cost is rows-touching-the-range × weeks
// rather than one row per calendar day.
//
// The week list is passed in as an array rather than generated in SQL: the
// planner cannot estimate generate_series and was reaching for JIT on a
// 1500-cell result (130 ms of compile for 3 ms of work).
const capacityQuery = `
WITH weeks AS (
  SELECT w AS week_start FROM unnest($1::date[]) AS w
), alloc AS (
  SELECT a.person_id, w.week_start,
         SUM(a.hours_per_day * GREATEST(0,
             LEAST(a.end_date, w.week_start + 4) - GREATEST(a.start_date, w.week_start) + 1)) AS hours
  FROM weeks w
  JOIN assignments a ON a.start_date <= w.week_start + 6 AND a.end_date >= w.week_start
  GROUP BY 1, 2
)
SELECT p.id, p.name, p.weekly_hours, w.week_start, COALESCE(al.hours, 0)
FROM people p
CROSS JOIN weeks w
LEFT JOIN alloc al ON al.person_id = p.id AND al.week_start = w.week_start
ORDER BY p.name, p.id, w.week_start`

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The range is snapped outward to whole weeks: from down to its Monday, to up
// to its Sunday. The response echoes the snapped range and the week starts so
// the client never has to agree with the server about calendar math.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	weeks := weekStarts(from, to)
	if len(weeks) > maxWeeks {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("range covers %d weeks; maximum is %d", len(weeks), maxWeeks))
		return
	}

	rows, err := s.db.Query(r.Context(), capacityQuery, weeks)
	if err != nil {
		log.Printf("capacity query: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}
	defer rows.Close()

	resp := capacityResponse{
		From:   from.Format(dateLayout),
		To:     to.Format(dateLayout),
		Weeks:  make([]string, len(weeks)),
		People: []capacityRow{},
	}
	for i, wk := range weeks {
		resp.Weeks[i] = wk.Format(dateLayout)
	}

	// Rows arrive grouped by person and ordered by week, matching `weeks`, so
	// each person's Allocated fills left to right. The index map guards against
	// that assumption silently breaking if the ORDER BY ever changes.
	byID := map[int]int{}
	for rows.Next() {
		var (
			id        int
			name      string
			capacity  float64
			weekStart time.Time
			allocated float64
		)
		if err := rows.Scan(&id, &name, &capacity, &weekStart, &allocated); err != nil {
			log.Printf("capacity scan: %v", err)
			writeError(w, http.StatusInternalServerError, "could not load capacity")
			return
		}
		idx, ok := byID[id]
		if !ok {
			idx = len(resp.People)
			byID[id] = idx
			resp.People = append(resp.People, capacityRow{
				ID:          id,
				Name:        name,
				WeeklyHours: capacity,
				Allocated:   make([]float64, 0, len(weeks)),
			})
		}
		resp.People[idx].Allocated = append(resp.People[idx].Allocated, round2(allocated))
	}
	if err := rows.Err(); err != nil {
		log.Printf("capacity rows: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// parseRange validates the query parameters and snaps them to whole weeks.
func parseRange(fromStr, toStr string) (from, to time.Time, err error) {
	if fromStr == "" || toStr == "" {
		return from, to, errors.New("from and to are required (YYYY-MM-DD)")
	}
	from, err = time.Parse(dateLayout, fromStr)
	if err != nil {
		return from, to, fmt.Errorf("from: expected YYYY-MM-DD, got %q", fromStr)
	}
	to, err = time.Parse(dateLayout, toStr)
	if err != nil {
		return from, to, fmt.Errorf("to: expected YYYY-MM-DD, got %q", toStr)
	}
	if to.Before(from) {
		return from, to, errors.New("to must not be before from")
	}
	return mondayOf(from), mondayOf(to).AddDate(0, 0, 6), nil
}

// mondayOf returns the Monday on or before d.
func mondayOf(d time.Time) time.Time {
	offset := (int(d.Weekday()) + 6) % 7 // Monday=0 … Sunday=6
	return d.AddDate(0, 0, -offset)
}

// weekStarts lists every Monday from `from` (itself a Monday) through `to`.
func weekStarts(from, to time.Time) []time.Time {
	var weeks []time.Time
	for d := from; !d.After(to); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d)
	}
	return weeks
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}
