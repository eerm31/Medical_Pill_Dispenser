# Host tests for the scheduling system: make   (needs a C++11 compiler, no Arduino, no hardware)
# The automatic-rotation tests use the rotation code of ../../rotation-mechanism.
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
FW := ../firmware
ROT := ../../rotation-mechanism
INC := -I$(FW) -I$(ROT)/firmware
SRC := $(FW)/core/schedule.cpp $(FW)/core/auto_rotate.cpp $(ROT)/firmware/core/rotation.cpp test_main.cpp

all: build/test_main check-firmware
	./build/test_main

# main.cpp cannot run on a laptop, but it must at least compile against a stub of the Arduino core.
check-firmware:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -I$(ROT)/test/arduino_stub $(INC) $(FW)/main.cpp

build/test_main: $(SRC) $(ROT)/test/fake_drive.h $(wildcard $(FW)/core/*.h) $(wildcard $(ROT)/firmware/core/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) $(INC) $(SRC) -o $@

clean:
	rm -rf build

.PHONY: all clean check-firmware
