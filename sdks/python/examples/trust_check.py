"""Evaluate trust for an agent and check against a threshold."""

from clawprint import ClawPrint, ClawPrintError

cp = ClawPrint()

HANDLE = "legal-eagle"
MIN_SCORE = 70

try:
    trust = cp.trust(HANDLE)
except ClawPrintError as e:
    print(f"Trust check failed: {e}")
    raise SystemExit(1)

print(f"Agent:        @{trust.handle}")
print(f"Trust Score:  {trust.trust_score}")
print(f"Grade:        {trust.grade}")
print(f"ACP Ready:    {'Yes' if trust.acp_compatible else 'No'}")
print(f"Evaluated:    {trust.evaluated_at}")

if trust.trust_score >= MIN_SCORE:
    print(f"\n✅ Score {trust.trust_score} meets threshold ({MIN_SCORE})")
else:
    print(f"\n⚠️  Score {trust.trust_score} below threshold ({MIN_SCORE})")
