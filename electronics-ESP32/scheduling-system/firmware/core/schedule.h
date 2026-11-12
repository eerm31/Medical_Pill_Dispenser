// schedule.h
// The dose schedule: a clock and up to 12 scheduled doses (pill colour + time of day).
// Based on docs/visualizer/schedule-controller.js (school project, not medical advice).
//
// A dose becomes DUE when the clock reaches its time. It is only dispensed after the user taps TAKE.
// The clock alone never starts a dispense.

#ifndef SCHEDULE_H
#define SCHEDULE_H

#include <stdint.h>
#include <stddef.h>
#include "core/colors.h"

#define MAX_ENTRIES 12       // how many doses can be scheduled
#define MAX_PILLS 5          // most pills in one dose
#define RING_CAPACITY 11     // pills one ring holds (12 positions, one of them is the exit hole)
#define GRACE_MIN 30         // minutes a due dose can wait before it counts as MISSED
#define DAY_SECONDS 86400    // seconds in one day

// What the verification subsystem found after a dispense. Only VERIFIED counts as taken.
enum Verdict {
    VERDICT_NONE = 0,
    VERIFIED,
    NO_PILL,
    MULTIPLE,
    COUNT_MISMATCH
};

const char* verdictName(Verdict v);

enum class EntryStatus {
    PENDING,        // waiting for its time
    DUE,            // time reached, waiting for the tap
    TAKING,         // the tap happened, the pill is being dispensed
    TAKEN,          // dispensed and verified
    MISSED,         // nobody tapped within the grace time
    FAILED,         // dispensed but not verified
    INCOMPLETE,     // stopped part way: some pills came out, fewer than the dose needs
    FINISHED,       // the ring cannot give another complete dose (it can still hold pills, see ringPills)
    DELETED         // schedule was deleted by user
};

struct Entry {
    uint8_t id;
    Color color;
    uint16_t minutes;      // time of day in minutes after midnight
    uint8_t pills;         // how many pills to dispense (1 to MAX_PILLS)
    EntryStatus status;
    bool tomorrow;         // added after its time had passed today, so it counts for tomorrow
    Verdict verdict;
};

enum AddResult {
    ADD_OK,
    ADD_BAD_COLOR,
    ADD_BAD_TIME,
    ADD_FULL,
    ADD_DUPLICATE,
    ADD_BAD_PILLS
};

class Scheduler {
private:
    Entry entries[MAX_ENTRIES];
    int count;           // how many entries are used
    uint8_t nextId;      // the id the next entry gets
    uint32_t seconds;    // the clock: seconds since midnight
    uint8_t ring[COLOR_COUNT];   // pills left in the ring of each colour, shared by every dose of that colour

    Entry* findEntry(uint8_t id);
    void evaluate();     // updates PENDING -> DUE -> MISSED from the clock
    void newDay();
    static bool comesBefore(const Entry* a, const Entry* b);

public:
    Scheduler(uint32_t startSeconds = 8 * 3600);

    // Reads "H:MM" or "HH:MM", optionally followed by ":SS" (the seconds are dropped). Returns false if the text is not a valid time.
    static bool parseTime(const char* text, int* minutes);
    static void formatTime(int minutes, char out[6]);
    static const char* statusName(EntryStatus s);

    AddResult add(Color color, int minutes, uint8_t* idOut = NULL, int pills = 1);
    bool remove(uint8_t id);
    void clear();   // removes every dose

    // Sets the clock, for example from an RTC. If the new time is earlier than the old one, midnight has passed.
    void setClock(uint32_t secondsOfDay);
    // Moves the clock forward (used by the tests and the serial console).
    void advanceSeconds(uint32_t secondsToAdd);
    uint32_t getClock() { return seconds; }

    int getCount() { return count; }
    const Entry* find(uint8_t id);
    // Writes pointers to all entries into out[], earliest first. Returns how many there are.
    int sorted(const Entry* out[MAX_ENTRIES]);
    const Entry* due();    // the earliest DUE entry, or NULL
    const Entry* next();   // the next PENDING entry (today's first), or NULL

    // Ring inventory. It only goes down in confirmPill() and only goes up in setRingPills().
    int ringPills(Color c);
    bool setRingPills(Color c, int pills);   // after a refill, 0 to RING_CAPACITY
    int dosesLeft(const Entry* e);           // complete doses the ring can still give: floor(pills / e->pills)

    // The take flow: DUE -> TAKING -> TAKEN (only if VERIFIED) or FAILED.
    // beginTake() refuses a dose the ring cannot give in full (it becomes FINISHED) so the cartridge never turns for it.
    bool beginTake(uint8_t id);
    bool confirmPill(uint8_t id);            // one pill came out of the ring of a TAKING dose
    // pillsDone = pills already out: none -> back to DUE, some -> INCOMPLETE (it must not start again)
    void abortTake(uint8_t id, int pillsDone = 0);
    // Only a VERIFIED dose becomes TAKEN, and FINISHED when the ring cannot give another one like it.
    bool finishTake(uint8_t id, Verdict verdict);

    // Saving the entries, so they survive a power cycle. The caller stores the bytes (for example in NVS).
    size_t save(uint8_t* buffer, size_t capacity);
    bool load(const uint8_t* buffer, size_t length);
};

#endif
