"""
Debug script to check what the network agent actually returns
and identify orphan edges (edges referencing non-existent nodes).
"""
import json, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

from network_agent import build_network_graph

result = build_network_graph("Who is connected to Ravi?")

nodes = result.get("nodes", [])
edges = result.get("edges", [])
node_ids = {n["id"] for n in nodes}

print(f"Total nodes: {len(nodes)}")
print(f"Total edges: {len(edges)}")
print(f"Target: {result.get('target')}")
print(f"Summary: {result.get('summary')}")

# Find orphan edges (edges referencing missing nodes)
orphans = []
self_loops = []
for e in edges:
    if e["source"] not in node_ids:
        orphans.append(f"  MISSING SOURCE: {e['source']} -> {e['target']}")
    if e["target"] not in node_ids:
        orphans.append(f"  MISSING TARGET: {e['source']} -> {e['target']}")
    if e["source"] == e["target"]:
        self_loops.append(f"  SELF-LOOP: {e['source']}")

print(f"\nOrphan edges (missing node refs): {len(orphans)}")
for o in orphans[:10]:
    print(o)

print(f"\nSelf-loop edges: {len(self_loops)}")
for s in self_loops[:10]:
    print(s)

# Show some node IDs to understand format
print("\nSample node IDs:")
for n in nodes[:10]:
    print(f"  [{n['type']}] {n['id'][:60]}")

print("\nSample edges:")
for e in edges[:10]:
    print(f"  {e['source'][:40]} --{e['label']}--> {e['target'][:40]}")
