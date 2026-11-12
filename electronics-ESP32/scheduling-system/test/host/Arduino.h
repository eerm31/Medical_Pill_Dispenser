// Arduino.h
// A tiny fake of the Arduino library so the real program (firmware/main.cpp) can run on the laptop.
// Time only moves when the test moves it, Serial output is kept with the time it was printed, EEPROM is an array.

#ifndef HOST_ARDUINO_H
#define HOST_ARDUINO_H

#include <stdarg.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>

#define OUTPUT 1
#define INPUT 0
#define INPUT_PULLUP 2
#define LOW 0
#define HIGH 1

extern uint32_t g_micros;        // the clock of the fake board, in microseconds
extern long g_pinWrites;         // how many times a motor pin was written (0 means the cartridge did not move)

inline uint32_t micros() { return g_micros; }
inline uint32_t millis() { return g_micros / 1000UL; }
inline void pinMode(int, int) {}
inline void digitalWrite(int, int) { g_pinWrites++; }
inline int digitalRead(int) { return HIGH; }

struct LoggedLine {
    uint32_t atUs;
    std::string text;
};

class HostSerial {
public:
    std::vector<LoggedLine> lines;   // every finished line of output
    std::string current;
    std::string input;               // what the "computer" typed and the program has not read yet

    void begin(long) {}
    int available() { return (int)input.size(); }
    int read() {
        int c = (unsigned char)input[0];
        input.erase(0, 1);
        return c;
    }
    void type(const char* line) { input += line; input += '\n'; }

    void append(const char* text) {
        for (; *text; text++) {
            if (*text == '\n') {
                lines.push_back({g_micros, current});
                current.clear();
            } else {
                current += *text;
            }
        }
    }
    size_t print(const char* s) { append(s); return 0; }
    size_t println(const char* s) { append(s); append("\n"); return 0; }
    size_t println() { append("\n"); return 0; }
    size_t printf(const char* format, ...) {
        char buffer[160];
        va_list args;
        va_start(args, format);
        vsnprintf(buffer, sizeof(buffer), format, args);
        va_end(args);
        append(buffer);
        return 0;
    }
};

extern HostSerial Serial;

#endif
