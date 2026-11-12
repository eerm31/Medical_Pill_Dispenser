// eeprom_store.h
// Keeps the schedule and the turn settings in the Uno's memory, so they are still there after a power cut.
// Address 0 to 159: the schedule (entry format: id + color + seconds + pills + recur_interval + pillsRemaining = 12 bytes each).
// Address 160 to 167: the turn settings.
// Address 168 to 330: the dose log (the last 10 dose events, see dose_log.h).

#ifndef EEPROM_STORE_H
#define EEPROM_STORE_H

#include <Arduino.h>
#include <EEPROM.h>

#define SCHEDULE_ADDRESS 0
#define SCHEDULE_BYTES 160      // 12 max entries × 12 bytes per entry + 3 header = 147 bytes (headroom up to 160)
#define SETTINGS_ADDRESS 160
#define SETTINGS_BYTES 8
#define LOG_ADDRESS 168

class Store {
public:
    // call this once in setup() (the Uno needs nothing here)
    void begin() {
    }

    void read(int address, uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            data[i] = EEPROM.read(address + i);
        }
    }

    void write(int address, const uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            EEPROM.update(address + i, data[i]);   // update() only writes a byte that changed, the memory wears out slowly
        }
    }
};

#endif
