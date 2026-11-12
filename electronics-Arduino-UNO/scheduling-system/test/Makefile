# Tests for the scheduling system (Arduino Uno sketch folder). Run with: make   (needs a C++ compiler, no Arduino)
# The automatic-rotation tests use the fake drum from ../../rotation-mechanism/test
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
SK := ..
ROT := ../../rotation-mechanism
SOURCES := $(SK)/schedule.cpp $(ROT)/auto_rotate.cpp $(SK)/cartridge_turn.cpp $(ROT)/rotation.cpp $(ROT)/colors.cpp test_main.cpp

all: build/test_main check-sketch
	./build/test_main

# The .ino sketch cannot run on a laptop, but it must at least compile against a tiny fake Arduino.h.
check-sketch:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -x c++ -include Arduino.h -I$(ROT)/test/arduino_stub -I$(SK) -I$(ROT) $(SK)/scheduling-system.ino

build/test_main: $(SOURCES) $(ROT)/test/fake_drive.h $(wildcard $(SK)/*.h) $(wildcard $(ROT)/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(SK) -I$(ROT) $(SOURCES) -o $@

clean:
	rm -rf build

# The real sketch on the laptop with a fake Arduino, clock and EEPROM: the 5 pills / 2 per dose example.
dispensing: build/test_dispensing
	./build/test_dispensing

build/test_dispensing: test_dispensing.cpp $(SK)/src/scheduling-system.ino $(wildcard $(SK)/src/*.h) $(wildcard $(SK)/src/*.cpp) $(wildcard host/*.h)
	mkdir -p build
	$(CXX) -std=c++11 -Wall -Wextra -O1 -Ihost -I$(SK)/src -I$(ROT) test_dispensing.cpp $(SK)/src/schedule.cpp $(SK)/src/cartridge_turn.cpp $(SK)/src/RefillingSystem.cpp $(ROT)/colors.cpp -o $@

# The Refilling System alone, and then on the real sketch: one 30 degree move, limits, cancel, dose protection.
refill: build/test_refill
	./build/test_refill

build/test_refill: test_refill.cpp $(SK)/src/scheduling-system.ino $(wildcard $(SK)/src/*.h) $(wildcard $(SK)/src/*.cpp) $(wildcard host/*.h)
	mkdir -p build
	$(CXX) -std=c++11 -Wall -Wextra -O1 -Ihost -I$(SK)/src -I$(ROT) test_refill.cpp $(SK)/src/schedule.cpp $(SK)/src/cartridge_turn.cpp $(SK)/src/RefillingSystem.cpp $(ROT)/colors.cpp -o $@

.PHONY: all clean check-sketch dispensing refill
