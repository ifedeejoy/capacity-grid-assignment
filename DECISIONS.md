# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- What hours_per_day means and whether weekends count. The values are all multiples of one eighth and never above 1, which could be day fractions. I read them as hours, as the column says, and counted Monday to Friday only, because weekly_hours is a working-week number and 37% of assignments end on a weekend. Both are interpretation calls the schema leaves open.
- The JSON shape. One dense allocated array per person, aligned to a weeks array the server computes and echoes back. The browser derives over-allocation. The server stays a fact source.
- How the grid stays right after a save. The PATCH returns only the person, because weekly hours feed capacity and never allocation. So the grid patches one row from the response. No refetch, no reload. The edit shows optimistically, the server’s stored value replaces it, and a failed save rolls back with the attempted value one click from a retry.
- What the legend is for. Coloured squares beside labels read as checkboxes. I clicked them, nothing happened, and that became the status filter. The swatches are now the checkboxes.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- The first 8,413 assignment rows each appear 14 times, including the hand-written scenario for people 1 to 5. Not a defect: each week is fourteen equal slices plus one remainder row that tops it up to a round number. Ana’s first week is fourteen rows of 2.5 hours plus one of 5, which is exactly 40. In production I would still ask whoever owns that table whether this shape is intended.
- Every hours_per_day value is a multiple of one eighth and never above 1. Same explanation: thin slices, not day fractions. Multiplying by 8 puts a third of the team at 3x capacity, which is a bug report, not a roster.
- Eli Nakamura has zero weekly hours and twenty hours of work. Shown as “no capacity” and flagged, not as a divide by zero.
- Dee Okafor lands on exactly 40 of 40 in week three. That is the at-capacity boundary and it is amber, not red.


## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

- It shipped a legend that looked interactive and was not. I clicked it, nothing happened, and it became the filter. Its first fix then put a tick box beside each coloured square, two controls for one idea, so the swatch became the checkbox itself.
- Separately, I ran its diff through a PR-review skill I built for my personal workflow before merging. It had tied the optimistic-save rollback to a mounted-component guard. With the over filter on, an edit could hide the row mid-save, and a rejected save was silently kept while the row vanished as if it had worked. Proven with a failing test first, then fixed by moving save state into the data hook.


## What would you do differently with a week?

- Scale, in this order. Row virtualisation first: one request, render only the rows in view. Today’s 500 by 3 grid is already 1,500 cells and 28,000 pixels tall; production shape is 300,000 cells and no browser renders that. The wire cost is fine, roughly 1.5 MB for three thousand people over two years, so paging the request can wait. When the roster outgrows one request, cursor paging by name and id with the status filter and sort pushed into the SQL, because “who is over” has to see everyone, not the loaded page. Infinite scroll over that cursor, not page numbers. A manager scanning for red does not think in pages of fifty, and page boundaries hide exactly the comparison being made.
- Project breakdown on hover, range in the URL, keyboard navigation between cells, a name search.
- A version column on people so two managers editing the same person get a conflict instead of last write wins.

