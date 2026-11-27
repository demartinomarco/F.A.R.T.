# TRIAS capture fixtures

Real `StopEventNotificationRequest` responses from the KVV TRIAS endpoint, kept
verbatim (no hand-editing, no pretty-printing) so the situation/`notServiced`
parsing is tested against what the feed actually looks like rather than against
a guess. Captured 2026-11-27 between ~12:30 and ~14:10 UTC with the app's own
request shape (`buildStopEventRequestXml`, `NumberOfResults=20`,
`IncludeRealtimeData=true`). The responses do not contain the requestor ref.

| File                                 | Stop                                       | Why it is here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `karlsruhe-ebertstrasse.xml`         | `de:08212:91` Karlsruhe Ebertstraße        | 20 departures; 3 line-scope situations (`ScopeType=line`, no `Affects` stop list) referenced from `Service/SituationFullRef`; 11 departures keep a row warning; exactly one departure is `Cancelled` **and** `NotServicedStop` at the same time (line 6 → Tivoli); `Detail` carries operator HTML with named entities (`&lt;br /&gt;`, `&szlig;`).                                                                                                                                               |
| `baden-baden-festspielhaus.xml`      | `de:08211:32389` Baden-Baden Festspielhaus | 20 departures; both situations are station-scoped (`Affects` names this stop) — one `ScopeType=stopPoint`, one `ScopeType=route`, so "station-level" is not only the `stopPoint` shape; refs arrive on both `CallAtStop` and `Service` levels; after the banner partition no departure keeps a situation.                                                                                                                                                                                        |
| `waldstadt-zentrum-stop-closure.xml` | `de:08212:408` Waldstadt Zentrum           | The whole-stop case: one `ScopeType=stopPoint` situation, "Haltestelle Waldstadt Zentrum aufgehoben", whose `Affects` names exactly this stop and which all 20 departures reference, so the partition has to leave every row empty. It is announced for line 31 while the board runs line 4, two calls of which the feed still marks `NotServicedStop` — a stop notice and a per-call fact in the same response. The `Detail` spells the stop name with the German quotes `&bdquo;` … `&ldquo;`. |
| `karlsruhe-kaiserplatz-unserved.xml` | `de:08212:38` Karlsruhe Kaiserplatz        | A stop that exists in the static dataset and is served by nothing at the moment: 0 results plus `-4030 STOPEVENT_LOCATIONUNSERVED`. This is the answer the "stop is not being served" banner was written for.                                                                                                                                                                                                                                                                                    |
| `unknown-stop.xml`                   | `de:08212:9999999` (does not exist)        | The other `-4030`: `STOPEVENT_NOEVENTFOUND` for an id the feed has never heard of, where `Text` is a **nested** `<Text><Text>…</Text><Language>…</Language></Text>` structure, not a plain string. The banner shows the same copy for both codes.                                                                                                                                                                                                                                                |

Operator text is reproduced verbatim, including the feed's own typos
(`Haltentfall`), because the mapping must survive them.

## How the stops were found

The first three files came from probing the 220 busiest stops of
`src/lib/assets/stop-lines.json`; that pass found no unserved stop at all, since
by construction those stops always have departures. Sweeping all 2021 stops of
the dataset (2026-11-27) found 112 of them answering `-4030`, 33 carrying a
situation that names the queried stop, and 487 carrying a situation of some kind
— which is where Kaiserplatz and Waldstadt Zentrum come from.

## What ages

These are frozen responses and several situation windows end in early December
2026: `waldstadt-zentrum-stop-closure` (11 Dec), the `Haltentfall` /
`Umleitung` pair of `baden-baden-festspielhaus` (12 Dec), and two of the three
situations of `karlsruhe-ebertstrasse`. The specs are arranged so that this
costs nothing:

- `situations.spec.ts` runs mapping and the banner/row partition only. Neither
  applies the `validUntil` rule, so its counts stay true.
- `index.situations.spec.ts` runs the whole `getDepartures()` pipeline, expiry
  rule included, and therefore asserts membership rather than counts, leaning
  only on `100004572` (valid until 2027) and on KVV's open-ended sentinel of
  year 2500. The two `-4030` captures hold no situations at all, so their
  assertions do not expire.

Re-capture with the same request shape if a fixture ever needs refreshing; any
busy stop will do.
