// eeprom_store.h
// Keeps the schedule and the turn settings in the board's memory, so they are still there after a power cut.
// Address 0 to 71: the schedule (3 header bytes, 5 per dose, then the pill count of each ring). Address 72 to 79: the turn settings.
// Address 80 to 242: the dose log (the last 10 dose events, see core/dose_log.h).

#ifndef EEPROM_STORE_H
#define EEPROM_STORE_H

#include <Arduino.h>
#include <EEPROM.h>

#define STORE_SIZE 256
#define SCHEDULE_ADDRESS 0
#define SCHEDULE_BYTES 72
#define SETTINGS_ADDRESS 72
#define SETTINGS_BYTES 8
#define LOG_ADDRESS 80

class Store {
public:
    // call this once in setup()
    void begin() {
        EEPROM.begin(STORE_SIZE);
    }

    void read(int address, uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            data[i] = EEPROM.read(address + i);
        }
    }

    void write(int address, const uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            EEPROM.write(address + i, data[i]);
        }
        EEPROM.commit();   // on the ESP32 the bytes are only kept after commit()
    }
};

#endif
