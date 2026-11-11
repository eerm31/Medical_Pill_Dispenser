# Tests for the scheduling system (Arduino Uno sketch folder). Run with: make   (needs a C++ compiler, no Arduino)
# The automatic-rotation tests use the fake drum from ../../rotation-mechanism/test
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
SK := ..
ROT := ../../rotation-mechanism
SOURCES := $(SK)/schedule.cpp $(SK)/auto_rotate.cpp $(SK)/cartridge_turn.cpp $(SK)/rotation.cpp $(SK)/colors.cpp test_main.cpp

all: build/test_main check-sketch
	./build/test_main

# The .ino sketch cannot run on a laptop, but it must at least compile against a tiny fake Arduino.h.
check-sketch:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -x c++ -include Arduino.h -I$(ROT)/test/arduino_stub -I$(SK) $(SK)/scheduling-system.ino

build/test_main: $(SOURCES) $(ROT)/test/fake_drive.h $(wildcard $(SK)/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(SK) $(SOURCES) -o $@

clean:
	rm -rf build

.PHONY: all clean check-sketch
