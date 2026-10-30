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

## Frontend

- After a save the grid patches the one row from the PATCH response. No refetch: allocations don't depend on
  weekly hours, and refetching a 3000×104 grid to change one scalar is the wrong trade. The optimistic value
  shows immediately; the server's echoed value replaces it, so any server-side normalisation reaches the screen.
- Failed save: row rolls back to the previous hours, an inline error names the attempted value and offers
  Retry / Dismiss. The rest of the grid stays usable. While a save is in flight the row shows "saving…"
  instead of an input, so two in-flight saves on one row cannot race each other's rollback.
- Range change aborts the in-flight request. The previous grid stays on screen, dimmed, with a loading notice;
  a failed range keeps the previous grid and says which range it is actually showing.
- Dead end: a save against a stopped API sat in "saving…" until the Vite proxy gave up. Added a 15 s timeout
  on both calls, with messages a manager can read instead of "signal timed out".
- Over-allocation is colour plus a ▲ marker and visually-hidden text, not colour alone. Zero-capacity cells
  with allocation read "no capacity" instead of a divide-by-zero percentage.
- Dates are handled as UTC civil dates throughout; `new Date('2025-12-29')` in a UTC-8 browser is Dec 28.
- Default range is the seed's hand-written scenario (29 Dec 2025 – 18 Jan 2026), not today, so the grid lands
  somewhere interesting. "This week" is one click away.
- Tests: ISO-week numbering across the year boundary, the status boundary (40 of 40 is full, 40.004 is still
  full after 2-dp rounding), a late response for an abandoned range being ignored, and the save rollback.
- Deferred: row virtualisation and server-side paging for a few-thousand-person roster (500×3 renders fine,
  3000×104 cells would not); sorting and a name search; keyboard navigation between cells;
  a project breakdown on hover; persisting the range in the URL.
- Bug caught by actually typing into the date picker: Chrome fires change per keystroke, so "0002-01-18"
  landed as a real date and dragged the range to 1906; it also allows five-digit years, which crashed the
  range reducer on blur. `DateField` now only commits a 4-digit year in 2000–2099 and discards the rest.

## Self-review pass

- Bug found by reviewing the diff as a stranger, then proven with a throwaway test: save state lived in the
  row component, guarded by a mounted ref. With "Only over-allocated" on, raising someone's hours takes them
  out of the filter mid-save, the row unmounts, and a *rejected* save never rolled back — the grid kept the
  value the server refused, and the manager saw the row vanish as if it had worked. Save state now lives in
  `useCapacity` keyed by person id, rollback runs regardless of what is mounted, and a row with a pending or
  failed save stays visible under the filter. `CapacityGrid.test.tsx` is that exact scenario.
- Also from the pass: `stale` now compares against the range that was *requested*, not the server echo, so a
  future server that snaps differently can't leave the grid permanently "stale"; "This week" lost two
  redundant clamp calls; a duplicate ISO-week case was cut; the API gained tests for the week snapping.

## Manual pass and feedback

- Clicked through every goal in the brief in a real browser, screenshot per step (`.context/qa-*`): default
  range checked cell-by-cell against a direct SQL query, prev/next/this-week, typed date ranges, a valid edit,
  an invalid edit, a failed save, a failed range change, a failed first load, and Retry from each. Not seen by
  eye: the brief loading state (loads finish in ~10 ms locally) and light mode (machine is in dark mode).
- Feedback: the legend's coloured squares read as checkboxes and did nothing. They are now the filter: tick
  any mix of over / at capacity / within to show people with at least one such week, none ticked shows
  everyone. The separate "Only over-allocated" box was ours, not the scaffold's, so it went rather than
  duplicating the new "over" tick.
- Feedback, second round: a tick box beside a coloured square is two controls for one idea. The swatch is
  now the checkbox itself; the native input stays visually hidden so label, Tab, Space and focus ring work.
