"""The UI System pages (electronics-*/scheduler-ui) set the dose schedule on the board over USB.

ASSUMED / NOT_VALIDATED. Keeps the page's rules and commands equal to the firmware, and the two boards' pages equal.
"""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BOARDS = {
    "uno": ROOT / "electronics-Arduino-UNO",
    "esp32": ROOT / "electronics-ESP32",
}
FIRMWARE_MAINS = {
    "uno": BOARDS["uno"] / "scheduling-system" / "src" / "scheduling-system.ino",
    "esp32": BOARDS["esp32"] / "scheduling-system" / "firmware" / "main.cpp",
}
SCHEDULE_H = BOARDS["esp32"] / "scheduling-system" / "firmware" / "core" / "schedule.h"


def _read(path):
    return path.read_text(encoding="utf-8")


def _num(pattern, text):
    return int(re.search(pattern, text).group(1))


def test_both_boards_use_the_same_page_code():
    for name in ("scheduler.js", "scheduler.css"):
        assert _read(BOARDS["uno"] / "scheduler-ui" / name) == _read(BOARDS["esp32"] / "scheduler-ui" / name), name


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_rules_match_the_firmware(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    header = _read(SCHEDULE_H)
    assert _num(r"MAX_ENTRIES = (\d+)", js) == _num(r"#define MAX_ENTRIES (\d+)", header)
    assert _num(r"MAX_PILLS = (\d+)", js) == _num(r"#define MAX_PILLS (\d+)", header)
    html = _read(BOARDS[board] / "scheduler-ui" / "index.html")
    assert 'max="%d"' % _num(r"#define MAX_PILLS (\d+)", header) in html


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_every_command_the_page_sends_exists_in_the_firmware(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    firmware = _read(FIRMWARE_MAINS[board])
    sent = set(re.findall(r"(?:send|next)\('([a-z]+)[ ']", js))
    assert {"time", "clear", "add", "save", "list"} <= sent
    for command in sent:
        assert 'strcmp(command, "%s") == 0' % command in firmware, command


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_reads_the_lines_the_firmware_prints(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    firmware = _read(FIRMWARE_MAINS[board])
    for word in ("clock ", "saved "):
        assert word in firmware, word
    assert "/^clock /" in js and "/^saved " in js


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_board_keeps_the_schedule_in_memory(board):
    firmware = _read(FIRMWARE_MAINS[board])
    assert "schedule.load(" in firmware and "schedule.save(" in firmware


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_every_element_the_page_uses_exists(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    html = _read(BOARDS[board] / "scheduler-ui" / "index.html")
    for element_id in set(re.findall(r"\$\('([A-Za-z0-9]+)'\)", js)):
        assert 'id="%s"' % element_id in html, element_id
    assert 'src="scheduler.js"' in html and 'href="scheduler.css"' in html


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_stays_offline(board):
    for name in ("index.html", "scheduler.js", "scheduler.css"):
        text = _read(BOARDS[board] / "scheduler-ui" / name)
        assert not re.search(r"https?://|eval\(|new Function|innerHTML", text), name
