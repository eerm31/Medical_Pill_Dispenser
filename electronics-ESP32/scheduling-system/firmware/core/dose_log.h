// dose_log.h
// The last LOG_MAX dose events, kept in the board's memory. Once the log is full a new event overwrites the oldest one.
// S is the Store class of the board (read/write of bytes at an address), so nothing is kept in RAM.

#ifndef DOSE_LOG_H
#define DOSE_LOG_H

#include <stdint.h>
#include <stddef.h>

#define LOG_MAX 10
#define LOG_RECORD_BYTES 16
#define LOG_BYTES (3 + LOG_MAX * LOG_RECORD_BYTES)   // magic, count, next slot, then the records
#define LOG_MAGIC 0xB1

enum LogStatus {
    LOG_COMPLETED = 1,
    LOG_INCOMPLETE,
    LOG_FAILED,
    LOG_FINISHED
};

struct LogRecord {
    uint8_t id;
    uint8_t status;      // a LogStatus
    uint8_t done;        // pills that came out
    uint8_t needed;      // pills the dose asked for
    uint32_t scheduled;  // seconds since midnight
    uint32_t started;
    uint32_t ended;
};

inline void logPut32(uint8_t* p, uint32_t v) {
    p[0] = (uint8_t)(v & 0xFF);
    p[1] = (uint8_t)((v >> 8) & 0xFF);
    p[2] = (uint8_t)((v >> 16) & 0xFF);
    p[3] = (uint8_t)((v >> 24) & 0xFF);
}

inline uint32_t logGet32(const uint8_t* p) {
    return p[0] + (uint32_t)p[1] * 256 + (uint32_t)p[2] * 65536 + (uint32_t)p[3] * 16777216;
}

// header bytes are {magic, count, next slot}; anything else (erased memory) means an empty log
template <class S>
void logHeader(S& store, int address, uint8_t h[3]) {
    store.read(address, h, 3);
    if (h[0] != LOG_MAGIC || h[1] > LOG_MAX || h[2] >= LOG_MAX) {
        h[0] = LOG_MAGIC;
        h[1] = 0;
        h[2] = 0;
    }
}

template <class S>
int logCount(S& store, int address) {
    uint8_t h[3];
    logHeader(store, address, h);
    return h[1];
}

template <class S>
void logAdd(S& store, int address, const LogRecord& r) {
    uint8_t h[3];
    logHeader(store, address, h);

    uint8_t b[LOG_RECORD_BYTES] = {0};
    b[0] = r.id;
    b[1] = r.status;
    b[2] = r.done;
    b[3] = r.needed;
    logPut32(b + 4, r.scheduled);
    logPut32(b + 8, r.started);
    logPut32(b + 12, r.ended);
    store.write(address + 3 + h[2] * LOG_RECORD_BYTES, b, LOG_RECORD_BYTES);

    h[2] = (uint8_t)((h[2] + 1) % LOG_MAX);
    if (h[1] < LOG_MAX) {
        h[1]++;
    }
    store.write(address, h, 3);
}

// index 0 is the oldest event that is still kept
template <class S>
bool logGet(S& store, int address, int index, LogRecord* out) {
    uint8_t h[3];
    logHeader(store, address, h);
    if (index < 0 || index >= h[1]) {
        return false;
    }
    int slot = (h[2] + LOG_MAX - h[1] + index) % LOG_MAX;
    uint8_t b[LOG_RECORD_BYTES];
    store.read(address + 3 + slot * LOG_RECORD_BYTES, b, LOG_RECORD_BYTES);
    out->id = b[0];
    out->status = b[1];
    out->done = b[2];
    out->needed = b[3];
    out->scheduled = logGet32(b + 4);
    out->started = logGet32(b + 8);
    out->ended = logGet32(b + 12);
    return true;
}

template <class S>
void logClear(S& store, int address) {
    uint8_t h[3] = {LOG_MAGIC, 0, 0};
    store.write(address, h, 3);
}

#endif
