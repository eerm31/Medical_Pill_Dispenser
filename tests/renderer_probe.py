"""Bounded supported-display evidence process, not a headless FPS surrogate.

Usage through the project interpreter; JSON is an actual runtime artifact.
Default protocol: 10 s warm-up + 60 s capture. CPU submission != GPU time.
"""
import argparse
import cProfile
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
import statistics
import sys
import time
import tracemalloc

from dispenser_sim.animation.loader import load_run_source
from dispenser_sim.animation.player import PlaybackSession
from dispenser_sim.animation.spans import SpanIndex

parser = argparse.ArgumentParser()
parser.add_argument("--output",required=True)
parser.add_argument("--workload",choices=("static","replay","orbit","failure"),default="static")
parser.add_argument("--warmup",type=float,default=10)
parser.add_argument("--capture",type=float,default=60)
parser.add_argument("--profile",action="store_true")
args = parser.parse_args()
output = Path(args.output)
result = {"workload":args.workload,"warmup_s":args.warmup,"capture_s":args.capture,
          "python":sys.version,"executable":sys.executable,"os":platform.platform(),"machine":platform.machine(),
          "pyglet":importlib.metadata.version("pyglet"),"vsync":True,"refresh_hz":"unknown", "viewport":[1220,800],
          "instrumented":args.profile,"gpu_execution_time":"not measured"}
try:
    from dispenser_sim.viz3d import glview
    import pyglet
    from pyglet import gl
    source = load_run_source("runs/00d370d37c0b")
    events = source.events()
    session = PlaybackSession(len(events),SpanIndex(events),start_cycle=20)
    viewer = glview._Viewer(source,session,source._run.pill_distribution)
    result["source_sha256"] = hashlib.sha256(Path(glview.__file__).read_bytes()).hexdigest()
    result["context"] = {"version":gl.gl_info.get_version_string(),"renderer":gl.gl_info.get_renderer(),"vendor":gl.gl_info.get_vendor()}
    controller = getattr(viewer,"controller",session)
    if args.workload in ("replay","failure"):
        controller.play()
    start = time.perf_counter()
    last = None
    intervals = []
    original = viewer.on_draw
    cpu_start = None
    profiler = cProfile.Profile() if args.profile else None
    if args.profile:
        tracemalloc.start()
    def draw():
        global last,cpu_start
        now = time.perf_counter()
        elapsed = now-start
        if elapsed >= args.warmup:
            if cpu_start is None:
                cpu_start = time.process_time()
                if profiler:
                    profiler.enable()
            if last is not None:
                intervals.append((now-last)*1000)
            last = now
        if args.workload == "orbit":
            viewer.camera.orbit(.5,.05)
            if hasattr(viewer,"_camera_dirty"):
                viewer._camera_dirty = True
        if args.workload == "failure" and getattr(controller,"position",0) > 100:
            controller.seek(20); controller.play()
        original()
        if elapsed >= args.warmup+args.capture:
            result["status"] = "CAPTURED"
            result["frame_intervals_ms"] = intervals
            ordered = sorted(intervals)
            result["p50_ms"] = statistics.median(intervals) if intervals else None
            result["p95_ms"] = ordered[min(len(ordered)-1,int(.95*len(ordered)))] if ordered else None
            result["misses_over_16_7_ms"] = sum(v > 16.7 for v in intervals)
            result["cpu_time_s"] = time.process_time()-(cpu_start or time.process_time())
            result["retention"] = getattr(viewer,"resource_counters",None)
            if profiler:
                profiler.disable(); profiler.dump_stats(str(output)+".prof")
                result["python_traced_current_peak_bytes"] = tracemalloc.get_traced_memory()
                result["allocation_metric"] = "tracemalloc current/peak live Python bytes, not allocations/frame; instrumented capture is not FPS acceptance"
            output.write_text(json.dumps(result,indent=2))
            viewer.close(); pyglet.app.exit()
    viewer.on_draw = draw
    pyglet.app.run(interval=1/60)
except Exception as exc:
    result["status"] = "ERROR"
    result["error"] = f"{type(exc).__name__}: {exc}"
    output.write_text(json.dumps(result,indent=2))
    raise