# Feature 003 model review — Phase 18

**Status:** SC-027 touch-topology packet increment only; `NOT_VALIDATED`. This document is a design-review record, not proof of physical contact, fit, kinematics, dose behavior, printability, or manufacturing readiness.

## 1. Moving-part touch/contact table (SC-027; T116)

Contact points are null in the canonical graph unless a source gives a numeric point. The current SC-027 source gives none. Every row below therefore has an assumed interface/surface, `NOT_VALIDATED` status, and unresolved fit/feasibility; “touch” denotes a required topology relation, not demonstrated physical contact. The graph is in `assembly_schedule.touch_topology` in the canonical source. Named geometry nodes are topology/subfeature identifiers owned by existing physical components, not additional export identities.

| Moving part / group | Parent and driver/contact chain | Contact surface / point | Status and unresolved items |
|---|---|---|---|
| Rotating drum | Station Housing → Central Post / `drum-bearing` → Rotating Drum; the bearing carries the rotating interface. | Assumed post/bearing and drum/bearing surfaces; point **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; bearing geometry, fit, axial retention, and contact are unresolved. |
| Red tower set | Rotating Drum → Red tower socket → Red Cartridge → Red Cap via Red Cap Hinge Assembly; red label/tag/latch follow their existing cap/cartridge parents. | Assumed red socket/deck and cap-hinge interfaces; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; seating, hinge axis, and fit unresolved. |
| Blue tower set | Rotating Drum → Blue tower socket → Blue Cartridge → Blue Cap via Blue Cap Hinge Assembly; blue label/tag/latch follow existing parents. | Assumed blue socket/deck and cap-hinge interfaces; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; seating, hinge axis, and fit unresolved. |
| Green tower set | Rotating Drum → Green tower socket → Green Cartridge → Green Cap via Green Cap Hinge Assembly; green label/tag/latch follow existing parents. | Assumed green socket/deck and cap-hinge interfaces; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; seating, hinge axis, and fit unresolved. |
| Orange tower set | Rotating Drum → Orange tower socket → Orange Cartridge → Orange Cap via Orange Cap Hinge Assembly; orange label/tag/latch follow existing parents. | Assumed orange socket/deck and cap-hinge interfaces; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; seating, hinge axis, and fit unresolved. |
| Four upper blade/tab/spring sets | One existing color blade per cartridge (red, blue, green, orange): cartridge/station guides → its Upper Blade Tab; its slot engages the existing Vertical Pin only when that station is selected; its individual return spring links its tab seat to a candidate fixed reaction feature. | Guide faces, slot flank/pin engagement, tab spring seat, and fixed reaction surface are assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; selection contact, spring anchors, swept interfaces, and fixed-vs-rotating reaction conflict unresolved. No fifth blade or per-color carriage is introduced: one shared upper carriage/pin serves the selected blade. |
| Upper servo driver | Servo Unit / output-shaft subfeature → Servo Crank (radius 5.2 mm) → crank-pin subfeature → Connecting Rod (length 34 mm) → Pin Carriage. | Shaft/hub and crank-pin/rod-end surfaces assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; shaft axis, phase, joint centers, rod endpoints, and linkage closure unresolved. The stated radius/length do not establish a functioning linkage. |
| Shared upper carriage | Connecting Rod → Pin Carriage → left and right Carriage Rails; existing upper Pull Solenoid mounts on carriage → assumed solenoid guide → armature → existing Vertical Pin → selected color tab slot. | Rod joint, two sliding-guide faces, solenoid mount/guide, armature/pin coupling, and pin/slot flank assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; rail fit, carriage path, vertical axis, and selected-slot alignment unresolved. Upper pin solenoid is the existing **Pull Solenoid** identity. |
| Shared lower tongue actuator | Station Housing mount → lower pull-solenoid body (integrated submesh under Tongue Actuator Rod) → lower plunger guide → lower plunger → lower moving carriage → strap → the single Shared Lower Tongue. The lower actuator body is a fixed reaction member; the driven plunger/carriage/strap/tongue constitute the moving path. | Body mount, coaxial guide, plunger/carriage seat, carriage/strap, and strap/tongue surfaces assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; lower actuator, plunger, carriage, strap sections, alignment, force, and interfaces unresolved. All lower actuator nodes remain subfeatures of existing identities; no new physical ID. |
| Lower compression spring | Existing Tongue Return Spring, concentric with the lower plunger, from moving lower carriage to the integrated fixed bracket feature owned by Station Housing. | Moving and fixed spring seats assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; seat geometry, rate, preload, force, travel, and feasibility unresolved. This SC-027 topology supersedes the previous A–K tongue-edge spring arrangement; it does not demonstrate that the spring works or contacts either seat. |
| Shared tongue guidance/closed position | Shared Lower Tongue → integrated Station Housing tongue guides and closed-seat candidate; exactly one global tongue, pulled conceptually along canonical −Y. | Guide faces and closed-stop seat assumed; points **unknown (`null`)**. | `ASSUMED` / `NOT_VALIDATED`; section, travel constraints, stop location, and fit unresolved. |
| Transient fictional pill path | Selected existing cartridge channel → transient pill actor → selected blade/chamber path → Shared Lower Tongue → outlet aperture → Outlet Tray. | Visual event/path only; no contact point is source-specified (**`null`**). | `DEMO_FIXTURE` / `NOT_VALIDATED`; nonphysical actor, not an exported component, not a mechanical connection and not dose or flow evidence. |

### Graph completeness and identity accounting

- Graph member coverage follows the existing `component_placements` groups: `rotating-drum`; four separate `station-red`, `station-blue`, `station-green`, and `station-orange` sets; `servo-linkage`; shared `carriage-slide`; shared `tongue-slide`; and declared stationary `scanner-electronics`. Fixed housing/post/tray nodes and the selected-station/transient-path aliases are also identified. `scanner-electronics` is explicitly stationary, not a moving mechanism group.
- Each color set contains its existing cartridge, cap, one blade, one blade-return spring, cap label plate, passive tag carrier, hinge assembly, and latch body. The shared upper Pin Carriage, two rails, upper Pull Solenoid, and Vertical Pin remain one set of existing components; only the indexed color slot is eligible to engage.
- Lower subfeature ownership is: `lower-tongue-pull-solenoid-body`, lower plunger guide, lower plunger, lower moving carriage, and strap under existing **Tongue Actuator Rod**; `Tongue Return Spring` remains the spring owner; fixed bracket/guides/seat are features of existing **Station Housing**. The upper vertical solenoid remains existing **Pull Solenoid**; no identity is merged with the lower actuator.
- Exactly **52** canonical physical component IDs remain. Topology nodes and integrated subfeature IDs add **zero** 3MF/export IDs. The transient pill and path/channel aliases are marked nonphysical.
- All graph interfaces are `ASSUMED` and `NOT_VALIDATED` or explicitly `UNRESOLVED`; every contact point is null. There is no physical contact pass. Servo/crank/rod/carriage closure, spring seating, blade spring reaction, lower actuator alignment, and all clearances remain unresolved.

### Source and conflict references retained

The current canonical `scale_audit` and its existing requested-size values/axis records are unchanged by T116. The prior corrected A–K placement schedule and conflicts remain in `assembly_schedule` as historical/assumed source candidates; no placement was moved or promoted. In particular, the old carriage/rail endpoint relation, servo/pivot and rod closure, upper spring extents/anchors, and previous tongue-spring positions/lengths are not evidence of contact. The new user-specified lower spring chain supersedes the former A–K tongue-edge-to-positive-Y-pad path for this topology record, while preserving that conflict and its old coordinates as history. Upper blade springs' fixed-reaction request also conflicts with the existing A–K rotating-station spring placements; candidate reaction-seat nodes are unresolved, not asserted contacts.

## 2. Requested-size ratio table (SC-026; later packet section)

Pending separate report assembly from the current canonical `scale_audit`; this section intentionally introduces no copied or recomputed dimensions. Source records are already retained in `src/dispenser_sim/viz3d/concept_geometry.json`. No new physical measurement or tolerance is implied.

## 3. Overlap, intended-contact, and unresolved list (SC-030; later packet section)

Pending the ordered tower/removal/line-of-sight review. No pairwise overlap, removal sweep, occlusion, or clearance result is asserted here. A topology edge is not an overlap pass.

## 4. Top orthographic dimension view (SC-031; later packet section)

Pending later SC-031 evidence. No view or dimension geometry is fabricated in this T116 increment.

## 5. Side orthographic dimension view (SC-031; later packet section)

Pending later SC-031 evidence. No view or dimension geometry is fabricated in this T116 increment.

**Readiness boundary:** This partial review remains `NOT_VALIDATED`, not a clearance/contact validation, and makes no print-ready, fabricability, dose-integrity, or feature-convergence claim. Required unknown contact surfaces and feasibility are unresolved.