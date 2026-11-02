# Standalone tests

Run `bash tools/run-tests.sh [filename-filter]` from this checkout.

The shared harness and the complete environment/build/replay instructions are in
[`lib_flow_engine/tools/TESTING.md`](../../lib_flow_engine/tools/TESTING.md).
Place the five Flow repositories side by side and import the Engine harness
commit as well. This runner reports missing prerequisites before launching tests.
