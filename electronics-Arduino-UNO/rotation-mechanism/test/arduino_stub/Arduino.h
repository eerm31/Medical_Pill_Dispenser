// Minimal stand-in for the Arduino Uno core, only so that the .ino sketches and the hardware file can be
// syntax-checked on a laptop. It has no printf on purpose: the Uno's Serial does not have printf.
#pragma once
#include <stdint.h>
#include <stdio.h>

#define OUTPUT 1
#define INPUT 0
#define INPUT_PULLUP 2
#define LOW 0
#define HIGH 1
#define F(text) (text)

inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return HIGH; }
inline unsigned long millis() { return 0; }
inline unsigned long micros() { return 0; }

struct SerialStub {
  void begin(unsigned long) {}
  void print(const char* s) { fputs(s, stdout); }
  void print(char c) { putchar(c); }
  void print(int n) { printf("%d", n); }
  void print(unsigned int n) { printf("%u", n); }
  void print(long n) { printf("%ld", n); }
  void print(unsigned long n) { printf("%lu", n); }
  void println() { putchar('\n'); }
  void println(const char* s) { puts(s); }
  void println(int n) { printf("%d\n", n); }
  void println(unsigned int n) { printf("%u\n", n); }
  int available() { return 0; }
  int read() { return -1; }
};
static SerialStub Serial;
