# Contract: Follow-up events and simulated inputs

Interface between weight verification (this feature) and the **later lid-control feature** and the Feature 005 sequences. This feature only **emits** requests and **reads** simulated conditions; it never opens, closes, locks or unlocks a lid or gate, never rotates the drum and never alters a dispense sequence (FR-014). All values ASSUMED / NOT_VALIDATED.

## Emitted: requests (at most one per not-verified record, FR-010)

```text
FollowUpRequest = {
  "kind": "RETRY" | "LOCK" | "REREAD",
  "compartment": "RED" | "BLUE" | "GREEN" | "ORANGE",
  "reason": "SHORT_RETRY" | "RETRY_EXHAUSTED" | "EXCESS_QUARANTINE" | "UNSTABLE_READING",
  "attempt": <int | null>,
  "prompt": "<user text, RETRY only>",
  "log": <bool>
}
```

| Trigger | `kind` | `reason` | Notes |
|---|---|---|---|
| `SHORT`, attempt < 3 | `RETRY` | `SHORT_RETRY` | prompt asks the user to add the missing pills and close the lid; baseline retained |
| `SHORT`, attempt = 3 | `LOCK` | `RETRY_EXHAUSTED` | `log = true`; hold `RETRY_EXHAUSTED` |
| `EXCESS` | `LOCK` | `EXCESS_QUARANTINE` | accompanied by `FLAG(QUARANTINED)`; never `RETRY` or an unlock |
| `UNSTABLE` | `REREAD` | `UNSTABLE_READING` | no state change |
| `VERIFIED`, `ABSENT`, any refusal | none | | `ABSENT` emits `NOTICE(COMPARTMENT_ABSENT)` only |

There is **no** `UNLOCK`, `OPEN`, `ROTATE`, `PAD_UP` request to other features. Pad motion is internal to the weighing station.

## Emitted: notifications (not requests)

| Type | Payload | When |
|---|---|---|
| `NOTICE` | `COMPARTMENT_ABSENT`, `READING_DISCARDED(condition)`, `SESSION_INCOMPLETE` | absent outcome; disturbance during a reading; restart between baseline and after-weight |
| `FLAG` | `QUARANTINED(compartment)` set / cleared | `EXCESS`; supervised reset |
| `LOG` | `REPEATED_FAILURE(compartment, count)` | 3 consecutive failed verifications (FR-013) |

Quarantine and retry-exhaustion holds are persistent compartment state, not events. The lid-control feature may read `hold`; it may not clear it.

## Consumed: simulated inputs (A-009)

| Input | Meaning | Disturbs a reading when |
|---|---|---|
| `at_station` | compartment at the fill position (Feature 005 confirmed station, A-012) | `false` |
| `drum_state` | `STILL` or `ROTATING` | `ROTATING` |
| `lift_in_progress` | a cartridge is being lifted/inserted | `true` |
| `lid_closed` | cap of that compartment confirmed closed | `false` |
| `sequence_active` | Feature 005 pin/gate sequence running | `true` |
| `compartment_present` | cartridge seated | `false` ⇒ outcome `ABSENT` |
| `lid_actuator_parked` | later feature's latch actuator not in contact | `false` |
| `restart` | power loss / restart | between baseline and after-weight ⇒ `INCOMPLETE` |
| `supervised_reset` | emptied, cleaned, authorised reset | clears `QUARANTINED` / `RETRY_EXHAUSTED` |

## Obligations placed on the later lid-control feature (constraints, not implementation)

1. Keep the latch actuator parked and non-contacting while a reading is taken (otherwise load is shunted around the cell).
2. Do not open a lid of a compartment that has an open `LOCK` request unless the hold is cleared by supervised reset.
3. Treat `RETRY` as a prompt request only; the user action and the next `lid_closed` input start the next attempt.
4. Do not rotate the drum while the weighing station reports a reading in progress.

## Rules

- Events are deterministic and ordered by a simulated clock; replaying a fixture yields identical events.
- No event or string may claim dose safety, single-dose integrity or validated accuracy.
