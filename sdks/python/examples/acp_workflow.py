"""Full ACP workflow: search → trust check → hire → report."""

import sys

from clawprint import ClawPrint, ClawPrintError

# API key required for report step
cp = ClawPrint(api_key="cp_live_your_key_here")

MY_HANDLE = "my-orchestrator"
MIN_TRUST = 70

# ── Step 1: Search for a legal-research agent ────────────────────────
print("🔍 Searching for legal-research agents...")
results = cp.search(domain="legal-research", protocol="acp", limit=3)

if not results.results:
    print("No agents found.")
    sys.exit(1)

candidate = results.results[0]
handle = candidate.get("handle", "unknown")
print(f"   Found: @{handle}\n")

# ── Step 2: Trust evaluation ──────────────────────────────────────────
print(f"🛡️  Evaluating trust for @{handle}...")
try:
    trust = cp.trust(handle)
except ClawPrintError as e:
    print(f"   Trust check failed: {e}")
    sys.exit(1)

print(f"   Score: {trust.trust_score} ({trust.grade})")
print(f"   ACP:   {'✅' if trust.acp_compatible else '❌'}\n")

if trust.trust_score < MIN_TRUST:
    print(f"⚠️  Trust score below {MIN_TRUST}. Aborting.")
    sys.exit(1)

if not trust.acp_compatible:
    print("⚠️  Agent is not ACP compatible. Aborting.")
    sys.exit(1)

# ── Step 3: (your app logic — call the agent via ACP) ────────────────
print(f"🤝 Hiring @{handle} via ACP...")
print("   (your ACP integration goes here)\n")

# ── Step 4: Report the transaction ────────────────────────────────────
print("📝 Reporting transaction...")
try:
    cp.report(
        provider_handle=handle,
        requester_handle=MY_HANDLE,
        protocol="acp",
        outcome="completed",
        rating=5,
        response_time_ms=1200,
    )
    print("   ✅ Transaction reported successfully!")
except ClawPrintError as e:
    print(f"   Report failed: {e}")
