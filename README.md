# US Economic Calendar: CPI, NFP, GDP & FOMC Dates

Know exactly when the next jobs report, CPI print, GDP estimate or Fed decision lands. This actor builds a US economic release calendar straight from the agencies that publish the numbers, with the exact release time in both US Eastern and UTC, an impact rating, and a link to the official source.

It reads five official calendars:

| Agency | Releases |
|---|---|
| **BLS** (Bureau of Labor Statistics) | Employment Situation (NFP), CPI, PPI, JOLTS, Employment Cost Index, import/export prices, productivity |
| **BEA** (Bureau of Economic Analysis) | GDP (advance, second, third estimates), Personal Income and Outlays (PCE inflation), international trade |
| **Census Bureau** | Advance retail sales, housing starts and permits, new home sales, durable goods, construction spending |
| **Federal Reserve** | FOMC rate decisions, flagged when they come with the Summary of Economic Projections (dot plot) |
| **US Treasury** | Announced bill, note and bond auctions |

## Why official sources

Most economic calendar actors scrape ForexFactory or Investing.com. Those sites block automated traffic, so the actors need residential proxies, break when the page changes, and resell another company's data.

This actor reads the agencies' own published schedules: iCalendar feeds from BLS and BEA, the Census and Federal Reserve calendar pages, and the Treasury's Fiscal Data API. No proxies, no browser, no login, and a typical run finishes in a few seconds. US government data is public domain, so you can use the output commercially.

## Here's a real row it returns

```json
{
  "eventId": "2026-10-29-bea-gdp-advance-estimate-3rd-quarter-2026",
  "date": "2026-10-29",
  "timeEt": "08:30",
  "timestampUtc": "2026-10-29T12:30:00.000Z",
  "isAllDay": false,
  "agency": "BEA",
  "agencyName": "Bureau of Economic Analysis",
  "title": "GDP (Advance Estimate), 3rd Quarter 2026",
  "period": "3rd Quarter 2026",
  "impact": "high",
  "category": "growth",
  "url": "https://www.bea.gov/news/schedule",
  "notes": null,
  "alsoPublishedBy": [],
  "fetchedAt": "2026-09-25T17:01:40.424Z"
}
```

FOMC rows name the meeting and say what comes with the decision:

```json
{
  "date": "2026-10-28",
  "timeEt": "14:00",
  "timestampUtc": "2026-10-28T18:00:00.000Z",
  "agency": "Fed",
  "title": "FOMC Rate Decision",
  "period": "October 27-28, 2026 meeting",
  "impact": "high",
  "category": "central-bank",
  "notes": "Statement 2:00 PM ET; press conference 2:30 PM ET."
}
```

## Input

| Field | What it does |
|---|---|
| `range` | `today`, `tomorrow`, `this_week`, `next_week`, `next_7_days` (default), `this_month`, `next_month`, `next_30_days`, or `custom`. Dates are US Eastern. |
| `startDate`, `endDate` | `YYYY-MM-DD`, used when `range` is `custom`. |
| `impactLevels` | Any of `high`, `medium`, `low`. All by default. |
| `sources` | Any of `bls`, `bea`, `census`, `fed`, `treasury`. All by default. |
| `keyword` | Only releases whose title contains this text, e.g. `price index`. |
| `maxResults` | Cap on rows returned. Default 500. |

This week's high-impact releases only:

```json
{ "range": "this_week", "impactLevels": ["high"] }
```

Every inflation release next month:

```json
{ "range": "next_month", "keyword": "price" }
```

## Output fields

| Field | Meaning |
|---|---|
| `date`, `timeEt` | Release date and time in US Eastern, as the agency publishes it. |
| `timestampUtc` | The same moment in UTC, with daylight saving handled. `null` for Treasury auctions (see FAQ). |
| `agency`, `agencyName` | Who publishes it. |
| `title`, `period` | Release name and the period it covers, when the agency states it. |
| `impact` | `high`, `medium` or `low`. See below. |
| `category` | `labor`, `inflation`, `growth`, `consumer`, `housing`, `manufacturing`, `trade`, `central-bank`, `treasury-auction`, or `other`. |
| `url` | Official release page or schedule. |
| `notes` | Extra context, e.g. dot plot meetings, or the CUSIP and issue date for auctions. |
| `alsoPublishedBy` | For joint releases listed by two agencies (like the trade report from BEA and Census), the second agency. It appears once, not twice. |

## How impact is rated

The agencies don't rate their own releases, so the rating follows how markets conventionally treat them:

- **High:** Employment Situation (NFP), CPI, GDP, Personal Income and Outlays (PCE), advance retail sales, FOMC decisions.
- **Medium:** PPI, JOLTS, Employment Cost Index, import/export prices, productivity, international trade, housing starts, new home sales, durable goods, Treasury note and bond auctions.
- **Low:** everything else, such as regional employment, wholesale inventories and Treasury bill auctions.

Filter on `impactLevels` to keep only what you trade around.

## Pricing

One charge of **$0.007 per run**, however many releases it returns. A full month of the calendar costs the same as a single day. Runs that return nothing aren't charged.

## FAQ

**Does it include consensus forecasts or actual values?**
No. Consensus forecasts are compiled by private data vendors and aren't published by the agencies, so an official-source calendar can't include them. This actor is about the schedule: what releases, when, to the minute. Pair it with your data feed for actuals.

**How far ahead can I look?**
As far as each agency publishes. BLS, BEA and the Fed currently list releases through December 2026 (each publishes the next year once it is set), and Treasury auctions appear once announced, usually a week or two ahead.

**Why do Treasury auctions have no time?**
Treasury's data lists the auction date but not a time. By convention bill auctions close at 11:30 AM ET and note/bond auctions at 1:00 PM ET, but that isn't in the data, so the actor doesn't invent it.

**What if an agency's site is down?**
The run carries on with the other sources and logs which one failed. It only fails if every selected source is down.

**Can I schedule it?**
Yes. A daily or weekly Apify schedule with `range: "next_7_days"` keeps a rolling calendar fresh. Agencies occasionally move a release, so re-pulling beats a one-time download.

## Who uses it

- **Traders and algo developers** who pause strategies around NFP, CPI and FOMC windows.
- **Macro newsletters** that open the week with what's coming.
- **Fixed income desks** tracking auctions alongside inflation and jobs data.
- **Fintech and data teams** that need a clean, licence-safe calendar feed.
