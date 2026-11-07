// Dose schedule: a clock, up to 8 entries (pill colour + HH:MM) and their status.
// Port of docs/visualizer/schedule-controller.js. A due dose waits for a tap; the tap (not the clock) starts the dispense.
// No heap, no randomness, no network time: the caller supplies the time of day.
#pragma once
#include <stddef.h>

#include "core/colors.h"

namespace dispenser {

// Result of the verification subsystem for one dispense. Only VERIFIED counts as taken.
enum Verdict : uint8_t { VERDICT_NONE = 0, VERIFIED, NO_PILL, MULTIPLE, COUNT_MISMATCH };

inline const char* verdictName(Verdict v) {
  static const char* const names[] = {"none", "VERIFIED", "NO_PILL", "MULTIPLE", "COUNT_MISMATCH"};
  return v <= COUNT_MISMATCH ? names[v] : "?";
}

enum EntryStatus : uint8_t { PENDING = 0, DUE, TAKING, TAKEN, MISSED, FAILED };

struct Entry {
  uint8_t id;
  Color color;
  uint16_t minutes;  // minutes after midnight
  EntryStatus status;
  bool tomorrow;     // added after its time (plus grace) had already passed today
  Verdict verdict;
};

enum AddResult : uint8_t { ADD_OK = 0, ADD_BAD_COLOR, ADD_BAD_TIME, ADD_FULL, ADD_DUPLICATE };

class Scheduler {
 public:
  static const uint8_t MAX_ENTRIES = 8;
  static const uint16_t GRACE_MIN = 30;  // a dose that is not taken within 30 minutes becomes MISSED
  static const uint32_t DAY_S = 86400;

  explicit Scheduler(uint32_t startSeconds = 8UL * 3600UL);

  // "H:MM" or "HH:MM", 00:00 to 23:59. Returns false for anything else.
  static bool parseTime(const char* text, uint16_t* minutes);
  static void formatTime(uint16_t minutes, char out[6]);
  static const char* statusName(EntryStatus s);

  AddResult add(Color color, uint16_t minutes, uint8_t* idOut = nullptr);
  bool remove(uint8_t id);

  // Time of day in seconds (0..86399), for example from an RTC. A value lower than the previous one means midnight passed.
  void setClock(uint32_t secondsOfDay);
  // Moves the clock forward (tests and the serial console); handles midnight.
  void advanceSeconds(uint32_t seconds);
  uint32_t clock() const { return seconds_; }

  uint8_t count() const { return count_; }
  const Entry* find(uint8_t id) const;
  // Entries in time order (then colour order). Returns how many were written (at most MAX_ENTRIES).
  uint8_t sorted(const Entry* out[MAX_ENTRIES]) const;
  const Entry* due() const;   // earliest DUE entry, or nullptr
  const Entry* next() const;  // earliest PENDING entry (today first), or nullptr

  // Take flow. DUE -> TAKING -> TAKEN (only for VERIFIED) or FAILED.
  bool beginTake(uint8_t id);
  void abortTake(uint8_t id);
  bool finishTake(uint8_t id, Verdict verdict);

  // Entries survive a power cycle: the caller stores these bytes (for example in NVS). Statuses are rebuilt from the clock.
  size_t save(uint8_t* buf, size_t capacity) const;
  bool load(const uint8_t* buf, size_t length);

 private:
  Entry* findMutable(uint8_t id);
  void evaluate();
  void newDay();
  static bool before(const Entry* a, const Entry* b);

  Entry entries_[MAX_ENTRIES];
  uint8_t count_;
  uint8_t nextId_;
  uint32_t seconds_;
};

}  // namespace dispenser
