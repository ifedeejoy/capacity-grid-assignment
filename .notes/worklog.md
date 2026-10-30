# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## Data, before writing any code

- Profiled `db/seed.sql` offline first. 500 people, 12 projects, 126,195 assignment rows but only
  16,826 distinct (person, project, start, end, hours) tuples: ids 1–8413 each appear 14 times.
  `hours_per_day` is never above 1 (multiples of 1/8). No assignment starts on a weekend; 37% end on one.
  Person 5 (Eli Nakamura) has 0 weekly hours and still has assignments.
- Decision: take the data at face value. Sum every row, treat `hours_per_day` as hours. That is the only
  reading that produces a believable roster (a handful over, most under). De-duplicating means nobody is
  ever over-allocated; multiplying by 8 puts a third of the team at 3x. Both flagged for DECISIONS.md.
- Decision: only Monday–Friday earns hours. `weekly_hours` is a working-week number, so an assignment that
  ends on a Sunday contributes five days, not seven.

## API

- Contract: `GET /api/capacity` returns `weeks[]` plus one row per person with a dense `allocated[]`
  aligned to `weeks[]`. Over-allocation is derived on the client (allocated > weeklyHours); the server
  stays a plain fact source. Range is snapped outward to Monday..Sunday and echoed back.
- `PATCH /api/people/{id}` returns only `{id, name, weeklyHours}`. Weekly hours feed capacity, never
  allocation, so the client can patch its local row from this and be provably correct without a refetch.
- Query: closed-form weekday overlap (`LEAST(end, fri) - GREATEST(start, mon) + 1`) instead of a per-day
  `generate_series`. Verified against a brute-force per-day expansion for person 4 (45h, 40h).
- Dead end: generating the week list with `generate_series` inside the query. The planner guesses 1000
  rows, estimates a 14M-row loop, and JIT-compiles: 130 ms for 3 ms of real work. Passing the weeks
  from Go as a `date[]` parameter fixes the estimate; the default window is ~5 ms, two years ~150 ms.
- Range capped at 110 weeks (two years and change). A wider window is a client bug, not a need.
- Deferred: people pagination for a few-thousand-person roster; a GiST index on
  `daterange(start_date, end_date)` would replace the btree range scan at scale.
