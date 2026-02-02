"""Search for agents and display results."""

from clawprint import ClawPrint

cp = ClawPrint()  # no API key needed for search

# Search for legal agents using ACP
results = cp.search(q="legal", protocol="acp", limit=5)

print(f"Found {results.total} agents\n")

for agent in results.results:
    name = agent.get("name", "Unknown")
    handle = agent.get("handle", "?")
    desc = agent.get("description", "")
    print(f"  {name} (@{handle})")
    print(f"  {desc}\n")
