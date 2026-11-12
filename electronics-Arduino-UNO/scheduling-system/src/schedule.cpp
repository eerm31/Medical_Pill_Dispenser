// schedule.cpp

#include <stdio.h>
#include <string.h>
#include "schedule.h"

#define SAVE_MAGIC 0xD6       // first byte of the saved data: 12 bytes per dose, then the pill count of every ring
#define SAVE_MAGIC_OLD 0xD5   // the same without the ring counts at the end (read, never written)

const char* verdictName(Verdict v) {
    if (v == VERIFIED) {
        return "VERIFIED";
    }
    if (v == NO_PILL) {
        return "NO_PILL";
    }
    if (v == MULTIPLE) {
        return "MULTIPLE";
    }
    if (v == COUNT_MISMATCH) {
        return "COUNT_MISMATCH";
    }
    return "none";
}

const char* Scheduler::statusName(EntryStatus s) {
    if (s == PENDING) {
        return "PENDING";
    }
    if (s == DUE) {
        return "DUE";
    }
    if (s == TAKING) {
        return "TAKING";
    }
    if (s == TAKEN) {
        return "TAKEN";
    }
    if (s == MISSED) {
        return "MISSED";
    }
    if (s == INCOMPLETE) {
        return "INCOMPLETE";
    }
    if (s == FINISHED) {
        return "FINISHED";
    }
    if (s == DELETED) {
        return "DELETED";
    }
    return "FAILED";
}

static bool isDigit(char c) {
    return c >= '0' && c <= '9';
}

Scheduler::Scheduler(uint32_t startSeconds) {
    count = 0;
    nextId = 1;
    seconds = startSeconds % DAY_SECONDS;
    int c;
    for (c = 0; c < COLOR_COUNT; c++) {
        ring[c] = 0;   // a ring holds only what a refill put in (at most RING_CAPACITY)
    }
}

// ---------- time text ----------
bool Scheduler::parseTime(const char* text, uint32_t* seconds) {
    if (text == NULL) {
        return false;
    }

    const char* colon = strchr(text, ':');
    if (colon == NULL) {
        return false;
    }

    // the hour has 1 or 2 digits
    int hourDigits = (int)(colon - text);
    if (hourDigits < 1 || hourDigits > 2) {
        return false;
    }

    // count colons to determine format (HH:MM vs HH:MM:SS)
    int colonCount = 0;
    const char* p = text;
    while (*p) {
        if (*p == ':') colonCount++;
        p++;
    }

    // HH:MM format (2 parts)
    if (colonCount == 1) {
        if (strlen(colon + 1) != 2) {
            return false;
        }
        int hour = 0;
        int i;
        for (i = 0; i < hourDigits; i++) {
            if (isDigit(text[i]) == false) {
                return false;
            }
            hour = hour * 10 + (text[i] - '0');
        }
        if (isDigit(colon[1]) == false || isDigit(colon[2]) == false) {
            return false;
        }
        int minute = (colon[1] - '0') * 10 + (colon[2] - '0');
        if (hour > 23 || minute > 59) {
            return false;
        }
        *seconds = (uint32_t)hour * 3600 + (uint32_t)minute * 60;
        return true;
    }
    // HH:MM:SS format (3 parts)
    else if (colonCount == 2) {
        const char* secondColon = strchr(colon + 1, ':');
        if (secondColon == NULL) {
            return false;
        }
        if (strlen(colon + 1) < 5 || strlen(secondColon + 1) != 2) {
            return false;
        }
        int hour = 0;
        int i;
        for (i = 0; i < hourDigits; i++) {
            if (isDigit(text[i]) == false) {
                return false;
            }
            hour = hour * 10 + (text[i] - '0');
        }
        if (isDigit(colon[1]) == false || isDigit(colon[2]) == false) {
            return false;
        }
        int minute = (colon[1] - '0') * 10 + (colon[2] - '0');
        if (isDigit(secondColon[1]) == false || isDigit(secondColon[2]) == false) {
            return false;
        }
        int second = (secondColon[1] - '0') * 10 + (secondColon[2] - '0');
        if (hour > 23 || minute > 59 || second > 59) {
            return false;
        }
        *seconds = (uint32_t)hour * 3600 + (uint32_t)minute * 60 + (uint32_t)second;
        return true;
    }
    return false;
}

void Scheduler::formatTime(uint32_t seconds, char out[9]) {
    uint32_t h = (seconds / 3600) % 24;
    uint32_t m = (seconds % 3600) / 60;
    uint32_t s = seconds % 60;
    snprintf(out, 9, "%02lu:%02lu:%02lu", (unsigned long)h, (unsigned long)m, (unsigned long)s);
}

// ---------- adding and removing ----------
AddResult Scheduler::add(Color color, uint32_t seconds, uint8_t* idOut, int pills, uint32_t recur_interval) {
    if (color >= COLOR_COUNT) {
        return ADD_BAD_COLOR;
    }
    if (seconds >= DAY_SECONDS) {
        return ADD_BAD_TIME;
    }
    if (pills < 1 || pills > MAX_PILLS) {
        return ADD_BAD_PILLS;
    }
    if (count >= MAX_ENTRIES) {
        return ADD_FULL;
    }

    // the same pill at the same time can only be scheduled once
    int i;
    for (i = 0; i < count; i++) {
        if (entries[i].color == color && entries[i].seconds == seconds) {
            return ADD_DUPLICATE;
        }
    }

    Entry* e = &entries[count];
    e->id = nextId;
    e->color = color;
    e->seconds = seconds;
    e->pills = (uint8_t)pills;
    e->status = PENDING;
    e->verdict = VERDICT_NONE;
    e->recur_interval = recur_interval;

    // if the time (plus the grace time) is already over today, the dose is for tomorrow
    uint32_t endOfGrace = seconds + (uint32_t)GRACE_MIN * 60;
    e->tomorrow = (Scheduler::seconds > endOfGrace);

    if (idOut != NULL) {
        *idOut = nextId;
    }
    nextId++;
    count++;

    evaluate();
    return ADD_OK;
}

bool Scheduler::remove(uint8_t id) {
    int i;
    for (i = 0; i < count; i++) {
        if (entries[i].id == id) {
            // move all the entries after it one place forward
            int j;
            for (j = i; j < count - 1; j++) {
                entries[j] = entries[j + 1];
            }
            count--;
            return true;
        }
    }
    return false;
}

void Scheduler::clear() {
    count = 0;
}

// ---------- the clock ----------
// PENDING becomes DUE when the clock reaches the time, and DUE becomes MISSED after the grace time.
// TAKING, TAKEN and FAILED are only set by the take flow.
void Scheduler::evaluate() {
    int i;
    for (i = 0; i < count; i++) {
        Entry* e = &entries[i];
        if (e->tomorrow) {
            continue;   // not today, so ignore it
        }

        uint32_t start = e->seconds;
        uint32_t end = e->seconds + (uint32_t)GRACE_MIN * 60;

        if (e->status == PENDING && seconds >= start && seconds <= end) {
            e->status = DUE;
        } else if ((e->status == PENDING || e->status == DUE) && seconds > end) {
            e->status = MISSED;
        }
    }
}

// a new day: everything starts again, except a dose the ring can no longer give and a dose that is being dispensed
void Scheduler::newDay() {
    int i;
    for (i = 0; i < count; i++) {
        if (entries[i].status == FINISHED || entries[i].status == DELETED || entries[i].status == TAKING) {
            continue;
        }
        entries[i].status = PENDING;
        entries[i].tomorrow = false;
        entries[i].verdict = VERDICT_NONE;
    }
}

void Scheduler::setClock(uint32_t secondsOfDay) {
    secondsOfDay = secondsOfDay % DAY_SECONDS;

    // an earlier time than before means we passed midnight
    bool passedMidnight = (secondsOfDay < seconds);

    seconds = secondsOfDay;
    if (passedMidnight) {
        newDay();
    }
    evaluate();
}

void Scheduler::advanceSeconds(uint32_t secondsToAdd) {
    uint32_t total = seconds + secondsToAdd;
    bool passedMidnight = (total >= DAY_SECONDS);

    seconds = total % DAY_SECONDS;
    if (passedMidnight) {
        newDay();
    }
    evaluate();
}

// ---------- looking things up ----------
Entry* Scheduler::findEntry(uint8_t id) {
    int i;
    for (i = 0; i < count; i++) {
        if (entries[i].id == id) {
            return &entries[i];
        }
    }
    return NULL;
}

const Entry* Scheduler::find(uint8_t id) {
    return findEntry(id);
}

// true if a is earlier than b (same time: lower colour number first)
bool Scheduler::comesBefore(const Entry* a, const Entry* b) {
    if (a->seconds != b->seconds) {
        return a->seconds < b->seconds;
    }
    return a->color < b->color;
}

int Scheduler::sorted(const Entry* out[MAX_ENTRIES]) {
    int i;
    int j;
    for (i = 0; i < count; i++) {
        out[i] = &entries[i];
    }

    // bubble sort, there are only 8 entries
    for (i = 0; i < count - 1; i++) {
        for (j = 0; j < count - 1 - i; j++) {
            if (comesBefore(out[j + 1], out[j])) {
                const Entry* temp = out[j];
                out[j] = out[j + 1];
                out[j + 1] = temp;
            }
        }
    }
    return count;
}

const Entry* Scheduler::due() {
    const Entry* best = NULL;
    int i;
    for (i = 0; i < count; i++) {
        if (entries[i].status == DUE) {
            if (best == NULL || comesBefore(&entries[i], best)) {
                best = &entries[i];
            }
        }
    }
    return best;
}

const Entry* Scheduler::next() {
    const Entry* bestToday = NULL;
    const Entry* bestTomorrow = NULL;
    int i;
    for (i = 0; i < count; i++) {
        Entry* e = &entries[i];
        if (e->status != PENDING) {
            continue;
        }
        if (e->tomorrow) {
            if (bestTomorrow == NULL || comesBefore(e, bestTomorrow)) {
                bestTomorrow = e;
            }
        } else {
            if (bestToday == NULL || comesBefore(e, bestToday)) {
                bestToday = e;
            }
        }
    }

    if (bestToday != NULL) {
        return bestToday;
    }
    return bestTomorrow;
}

// ---------- the take flow ----------
int Scheduler::ringPills(Color c) {
    return c < COLOR_COUNT ? ring[c] : 0;
}

int Scheduler::dosesLeft(const Entry* e) {
    return e->pills > 0 ? ring[e->color] / e->pills : 0;   // never rounds up to a partial dose
}

bool Scheduler::setRingPills(Color c, int pills) {
    if (c >= COLOR_COUNT || pills < 0 || pills > RING_CAPACITY) {
        return false;
    }
    ring[c] = (uint8_t)pills;

    // a refill gives a FINISHED dose its turn again, but never for a time that is already reached today:
    // that dose may have been given just now, and a refill must not trigger it a second time
    int i;
    for (i = 0; i < count; i++) {
        Entry* e = &entries[i];
        if (e->color == c && e->status == FINISHED && dosesLeft(e) > 0) {
            e->status = PENDING;
            e->tomorrow = (seconds >= e->seconds);
        }
    }
    evaluate();
    return true;
}

bool Scheduler::beginTake(uint8_t id) {
    Entry* e = findEntry(id);
    if (e == NULL || e->status != DUE) {
        return false;
    }

    // not enough pills for the whole dose: no partial dose and no turning of the cartridge
    if (dosesLeft(e) < 1) {
        e->status = FINISHED;
        e->verdict = VERDICT_NONE;
        return false;
    }

    e->status = TAKING;
    return true;
}

// The caller confirms a pill after it has really come out. This is the only place the ring count goes down.
bool Scheduler::confirmPill(uint8_t id) {
    Entry* e = findEntry(id);
    if (e == NULL || e->status != TAKING || ring[e->color] == 0) {
        return false;
    }
    ring[e->color]--;
    return true;
}

void Scheduler::abortTake(uint8_t id, int pillsDone) {
    Entry* e = findEntry(id);
    if (e != NULL && e->status == TAKING) {
        e->status = pillsDone > 0 ? INCOMPLETE : DUE;
    }
}

bool Scheduler::finishTake(uint8_t id, Verdict verdict) {
    Entry* e = findEntry(id);
    if (e == NULL || e->status != TAKING) {
        return false;
    }
    if (verdict == VERIFIED) {
        e->status = TAKEN;
        e->verdict = verdict;
        if (dosesLeft(e) < 1) {
            e->status = FINISHED;   // no recurrence either: nothing is left to repeat
            return true;
        }
    } else {
        e->status = FAILED;
    }
    e->verdict = verdict;

    // If this is a recurring dose, schedule the next occurrence
    if (e->recur_interval > 0) {
        // the interval starts when the last pill of this dose has come out, not before
        uint32_t next_time = seconds + e->recur_interval;
        
        // Wrap to next day if needed
        if (next_time >= DAY_SECONDS) {
            e->seconds = next_time - DAY_SECONDS;
            e->tomorrow = true;
        } else {
            e->seconds = next_time;
            e->tomorrow = false;
        }
        e->status = PENDING;
        e->verdict = VERDICT_NONE;
        evaluate();
    }
    
    return true;
}

// ---------- saving and loading ----------
// Data format: magic byte, count, nextId, then 12 bytes per entry:
// id(1), color(1), seconds(4), pills(1), recur_interval(4), ring count of its colour(1)
// and after the entries one byte per ring: its pill count (so a ring keeps its pills when no dose is saved)
size_t Scheduler::save(uint8_t* buffer, size_t capacity) {
    size_t needed = 3 + (size_t)count * 12 + COLOR_COUNT;
    if (capacity < needed) {
        return 0;   // the buffer is too small
    }

    buffer[0] = SAVE_MAGIC;
    buffer[1] = (uint8_t)count;
    buffer[2] = nextId;

    int i;
    for (i = 0; i < count; i++) {
        uint8_t* p = buffer + 3 + i * 12;
        p[0] = entries[i].id;
        p[1] = (uint8_t)entries[i].color;
        p[2] = (uint8_t)(entries[i].seconds & 0xFF);
        p[3] = (uint8_t)((entries[i].seconds >> 8) & 0xFF);
        p[4] = (uint8_t)((entries[i].seconds >> 16) & 0xFF);
        p[5] = (uint8_t)((entries[i].seconds >> 24) & 0xFF);
        p[6] = entries[i].pills;
        p[7] = (uint8_t)(entries[i].recur_interval & 0xFF);
        p[8] = (uint8_t)((entries[i].recur_interval >> 8) & 0xFF);
        p[9] = (uint8_t)((entries[i].recur_interval >> 16) & 0xFF);
        p[10] = (uint8_t)((entries[i].recur_interval >> 24) & 0xFF);
        p[11] = ring[entries[i].color];
    }
    for (i = 0; i < COLOR_COUNT; i++) {
        buffer[3 + count * 12 + i] = ring[i];
    }
    return needed;
}

bool Scheduler::load(const uint8_t* buffer, size_t length) {
    bool hasRings = (length >= 3 && buffer[0] == SAVE_MAGIC);
    if (length < 3 || (buffer[0] != SAVE_MAGIC && buffer[0] != SAVE_MAGIC_OLD) || buffer[1] > MAX_ENTRIES) {
        return false;
    }
    int newCount = buffer[1];
    
    // Try new format (12 bytes per entry) first
    size_t needed = 3 + (size_t)newCount * 12;
    bool isNewFormat = (length >= needed);
    
    // If not enough for new format, try old format (11 bytes per entry) for backward compatibility
    if (!isNewFormat) {
        needed = 3 + (size_t)newCount * 11;
        if (length < needed) {
            return false;
        }
    }

    // read everything into a temporary list first, so a bad file does not change anything
    Entry loaded[MAX_ENTRIES];
    uint8_t savedRing[COLOR_COUNT];
    int i;
    for (i = 0; i < COLOR_COUNT; i++) {
        savedRing[i] = 255;   // 255 = this file says nothing about the ring
    }
    for (i = 0; i < newCount; i++) {
        size_t offset = isNewFormat ? (i * 12) : (i * 11);
        const uint8_t* p = buffer + 3 + offset;
        uint32_t seconds = p[2] + (uint32_t)p[3] * 256 + (uint32_t)p[4] * 65536 + (uint32_t)p[5] * 16777216;
        uint32_t recur_interval = p[7] + (uint32_t)p[8] * 256 + (uint32_t)p[9] * 65536 + (uint32_t)p[10] * 16777216;
        if (p[1] >= COLOR_COUNT || seconds >= DAY_SECONDS || p[6] < 1 || p[6] > MAX_PILLS) {
            return false;
        }
        loaded[i].id = p[0];
        loaded[i].color = (Color)p[1];
        loaded[i].seconds = seconds;
        loaded[i].pills = p[6];
        loaded[i].recur_interval = recur_interval;
        // byte 11 is the ring count of this colour (every entry of a colour carries the same number)
        if (isNewFormat && p[11] <= RING_CAPACITY && p[11] < savedRing[p[1]]) {
            savedRing[p[1]] = p[11];
        }
        loaded[i].status = PENDING;
        loaded[i].verdict = VERDICT_NONE;
        loaded[i].tomorrow = false;
    }

    count = newCount;
    nextId = buffer[2];
    if (hasRings && length >= 3 + (size_t)newCount * 12 + COLOR_COUNT) {
        for (i = 0; i < COLOR_COUNT; i++) {
            savedRing[i] = buffer[3 + newCount * 12 + i];   // these win over the copy kept with each dose
        }
    }
    for (i = 0; i < COLOR_COUNT; i++) {
        if (savedRing[i] <= RING_CAPACITY) {
            ring[i] = savedRing[i];
        }
    }
    for (i = 0; i < count; i++) {
        entries[i] = loaded[i];
        // entries whose time is long gone count for tomorrow
        uint32_t endOfGrace = (uint32_t)(entries[i].seconds + GRACE_MIN * 60);
        entries[i].tomorrow = (seconds > endOfGrace);
        // a dose the ring cannot give in full stays FINISHED after a restart
        if (dosesLeft(&entries[i]) < 1) {
            entries[i].status = FINISHED;
        }
    }
    evaluate();
    return true;
}
