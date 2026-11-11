// schedule.cpp

#include <stdio.h>
#include <string.h>
#include "schedule.h"

#define SAVE_MAGIC 0xD5   // first byte of the saved data, used to recognise it

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
    return "FAILED";
}

static bool isDigit(char c) {
    return c >= '0' && c <= '9';
}

Scheduler::Scheduler(uint32_t startSeconds) {
    count = 0;
    nextId = 1;
    seconds = startSeconds % DAY_SECONDS;
}

// ---------- time text ----------
bool Scheduler::parseTime(const char* text, int* minutes) {
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

    // the minutes have exactly 2 digits and nothing comes after them
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

    *minutes = hour * 60 + minute;
    return true;
}

void Scheduler::formatTime(int minutes, char out[6]) {
    snprintf(out, 6, "%02d:%02d", (minutes / 60) % 24, minutes % 60);
}

// ---------- adding and removing ----------
AddResult Scheduler::add(Color color, int minutes, uint8_t* idOut, int pills) {
    if (color >= COLOR_COUNT) {
        return ADD_BAD_COLOR;
    }
    if (minutes < 0 || minutes >= 24 * 60) {
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
        if (entries[i].color == color && entries[i].minutes == minutes) {
            return ADD_DUPLICATE;
        }
    }

    Entry* e = &entries[count];
    e->id = nextId;
    e->color = color;
    e->minutes = (uint16_t)minutes;
    e->pills = (uint8_t)pills;
    e->status = PENDING;
    e->verdict = VERDICT_NONE;

    // if the time (plus the grace time) is already over today, the dose is for tomorrow
    uint32_t endOfGrace = (uint32_t)(minutes + GRACE_MIN) * 60;
    e->tomorrow = (seconds > endOfGrace);

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

        uint32_t start = (uint32_t)e->minutes * 60;
        uint32_t end = (uint32_t)(e->minutes + GRACE_MIN) * 60;

        if (e->status == PENDING && seconds >= start && seconds <= end) {
            e->status = DUE;
        } else if ((e->status == PENDING || e->status == DUE) && seconds > end) {
            e->status = MISSED;
        }
    }
}

// a new day: everything starts again
void Scheduler::newDay() {
    int i;
    for (i = 0; i < count; i++) {
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
    if (a->minutes != b->minutes) {
        return a->minutes < b->minutes;
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
bool Scheduler::beginTake(uint8_t id) {
    Entry* e = findEntry(id);
    if (e == NULL || e->status != DUE) {
        return false;
    }
    e->status = TAKING;
    return true;
}

void Scheduler::abortTake(uint8_t id) {
    Entry* e = findEntry(id);
    if (e != NULL && e->status == TAKING) {
        e->status = DUE;
    }
}

bool Scheduler::finishTake(uint8_t id, Verdict verdict) {
    Entry* e = findEntry(id);
    if (e == NULL || e->status != TAKING) {
        return false;
    }
    if (verdict == VERIFIED) {
        e->status = TAKEN;
    } else {
        e->status = FAILED;
    }
    e->verdict = verdict;
    return true;
}

// ---------- saving and loading ----------
// Data format: magic byte, count, nextId, then 5 bytes per entry: id, colour, minutes (low byte), minutes (high byte), pills.
size_t Scheduler::save(uint8_t* buffer, size_t capacity) {
    size_t needed = 3 + (size_t)count * 5;
    if (capacity < needed) {
        return 0;   // the buffer is too small
    }

    buffer[0] = SAVE_MAGIC;
    buffer[1] = (uint8_t)count;
    buffer[2] = nextId;

    int i;
    for (i = 0; i < count; i++) {
        uint8_t* p = buffer + 3 + i * 5;
        p[0] = entries[i].id;
        p[1] = (uint8_t)entries[i].color;
        p[2] = (uint8_t)(entries[i].minutes & 0xFF);
        p[3] = (uint8_t)(entries[i].minutes >> 8);
        p[4] = entries[i].pills;
    }
    return needed;
}

bool Scheduler::load(const uint8_t* buffer, size_t length) {
    if (length < 3 || buffer[0] != SAVE_MAGIC || buffer[1] > MAX_ENTRIES) {
        return false;
    }
    int newCount = buffer[1];
    size_t needed = 3 + (size_t)newCount * 5;
    if (length < needed) {
        return false;
    }

    // read everything into a temporary list first, so a bad file does not change anything
    Entry loaded[MAX_ENTRIES];
    int i;
    for (i = 0; i < newCount; i++) {
        const uint8_t* p = buffer + 3 + i * 5;
        long minutes = p[2] + p[3] * 256L;   // long: p[3] * 256 does not fit in a 16-bit int
        if (p[1] >= COLOR_COUNT || minutes >= 24 * 60 || p[4] < 1 || p[4] > MAX_PILLS) {
            return false;
        }
        loaded[i].id = p[0];
        loaded[i].color = (Color)p[1];
        loaded[i].minutes = (uint16_t)minutes;
        loaded[i].pills = p[4];
        loaded[i].status = PENDING;
        loaded[i].verdict = VERDICT_NONE;
        loaded[i].tomorrow = false;
    }

    count = newCount;
    nextId = buffer[2];
    for (i = 0; i < count; i++) {
        entries[i] = loaded[i];
        // entries whose time is long gone count for tomorrow
        uint32_t endOfGrace = (uint32_t)(entries[i].minutes + GRACE_MIN) * 60;
        entries[i].tomorrow = (seconds > endOfGrace);
    }
    evaluate();
    return true;
}
