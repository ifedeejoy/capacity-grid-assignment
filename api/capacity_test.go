package main

import (
	"testing"
	"time"
)

func date(s string) time.Time {
	d, err := time.Parse(dateLayout, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestParseRangeSnapsToWholeWeeks(t *testing.T) {
	cases := []struct{ from, to, wantFrom, wantTo string }{
		{"2025-12-29", "2026-01-16", "2025-12-29", "2026-01-18"}, // Mon..Fri → Mon..Sun
		{"2026-01-01", "2026-01-01", "2025-12-29", "2026-01-04"}, // mid-week, across the year boundary
		{"2026-01-04", "2026-01-04", "2025-12-29", "2026-01-04"}, // a Sunday belongs to the week before
	}
	for _, c := range cases {
		from, to, err := parseRange(c.from, c.to)
		if err != nil {
			t.Fatalf("%s..%s: %v", c.from, c.to, err)
		}
		if got := from.Format(dateLayout); got != c.wantFrom {
			t.Errorf("%s..%s: from = %s, want %s", c.from, c.to, got, c.wantFrom)
		}
		if got := to.Format(dateLayout); got != c.wantTo {
			t.Errorf("%s..%s: to = %s, want %s", c.from, c.to, got, c.wantTo)
		}
	}
}

func TestParseRangeRejectsBadInput(t *testing.T) {
	for _, c := range [][2]string{
		{"", "2026-01-01"},
		{"2026-1-1", "2026-01-01"},
		{"2026-02-01", "2026-01-01"},
	} {
		if _, _, err := parseRange(c[0], c[1]); err == nil {
			t.Errorf("parseRange(%q, %q): expected an error", c[0], c[1])
		}
	}
}

func TestWeekStartsCoversEveryMondayInclusive(t *testing.T) {
	weeks := weekStarts(date("2025-12-29"), date("2026-01-18"))
	if len(weeks) != 3 {
		t.Fatalf("got %d weeks, want 3", len(weeks))
	}
	if last := weeks[2].Format(dateLayout); last != "2026-01-12" {
		t.Errorf("last week starts %s, want 2026-01-12", last)
	}
}
