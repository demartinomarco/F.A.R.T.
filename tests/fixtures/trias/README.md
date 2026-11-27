# TRIAS capture fixtures

Real `StopEventNotificationRequest` responses from the KVV TRIAS endpoint, kept
verbatim (no hand-editing, no pretty-printing) so the situation/`notServiced`
parsing is tested against what the feed actually looks like rather than against
a guess. Captured 2026-11-27 ~13:15 UTC with the app's own request shape
(`buildStopEventRequestXml`, `NumberOfResults=20`, `IncludeRealtimeData=true`).
The responses do not contain the requestor ref.

| File                            | Stop                                       | Why it is here                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `karlsruhe-ebertstrasse.xml`    | `de:08212:91` Karlsruhe Ebertstraße        | 20 departures; 3 line-scope situations (`ScopeType=line`, no `Affects` stop list) referenced from `Service/SituationFullRef`; 11 departures keep a row warning; exactly one departure is `Cancelled` **and** `NotServicedStop` at the same time (line 6 → Tivoli); `Detail` carries operator HTML with named entities (`&lt;br /&gt;`, `&szlig;`). |
| `baden-baden-festspielhaus.xml` | `de:08211:32389` Baden-Baden Festspielhaus | 20 departures; both situations are station-scoped (`Affects` names this stop) — one `ScopeType=stopPoint`, one `ScopeType=route`, so "station-level" is not only the `stopPoint` shape; refs arrive on both `CallAtStop` and `Service` levels; after the banner partition no departure keeps a situation.                                          |
| `unknown-stop.xml`              | `de:08212:9999999` (does not exist)        | The "nothing here" shape: 0 `StopEventResult`s plus one `ErrorMessage` `-4030 STOPEVENT_NOEVENTFOUND`, where `Text` is a **nested** `<Text><Text>…</Text><Language>…</Text>` structure, not a plain string.                                                                                                                                        |

Operator text is reproduced verbatim, including the feed's own typos
(`Haltentfall`), because the mapping must survive them.

Situation validity periods are far enough in the future that these captures stay
meaningful for a while, but they are frozen data: the assertions describe this
network state, not today's. Re-capture with the same request shape if a fixture
ever needs refreshing (any busy stop will do — 118 of the 220 stops probed for
these files carried situations that day).
