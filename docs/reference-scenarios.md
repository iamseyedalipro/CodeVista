# Reference application and walkthroughs

All data is synthetic. `examples/reference/application.ts` is an executable behavior
fixture, not a deployment or a production authentication/payment implementation.
Gateway status, verification, account state, and response status are supplied inputs.
Nothing contacts a payment gateway or an AI provider. Symbols named `Before` and
`After` let both map versions point to inspectable source in the same checkout.

`before/manifest.json` and `after/manifest.json` describe separate map snapshots,
not merged branches. In a real repository, the viewer will load one immutable
revision at a time. Comparing these directories is test evidence for the format;
it is not an implemented PR-comparison feature.

## Three user scenarios from Phase 0

| User task | Expected visible map result |
| --- | --- |
| Start on an existing repository | The user's agent inspects the code, creates the overview and process files, and explicitly lists unreviewed areas. The future site displays them only after GitHub contains them. |
| Add a feature | Adding discounts changes Payment and introduces Discount and Eligibility. Shared Subscription and unrelated existing definitions retain their identities and content. |
| Fix an existing bug | Rejecting disabled accounts inserts an account-state decision in Sign-in; the credentials-accepted edge keeps its ID and points to that decision. |

The first row is a future browser/agent acceptance scenario. Phase 1 supplies the
inspectable reference output; it has not exercised hosted onboarding or an external
cloud agent. A public example exists in this repository. An owner-approved private
pilot repository is still to be selected before the connection/privacy trials.

## Sign-in: bug fix, retry, cancellation

Start → check whether an attempt is available → check cancellation → check
credentials. Invalid credentials advance the attempt counter and loop back to the
availability decision. No remaining attempt, or three processed attempts, ends in
an error. Cancellation ends without signing in.

In the **before** map, valid credentials go straight to Signed in. A disabled
account can therefore enter; this intentionally models the fixture's old bug.
In **after**, the same `login.credentials-accepted` edge goes to Is the account
enabled? Enabled accounts succeed; disabled accounts end at Account disabled.

The new map retains all earlier node and edge IDs. It changes the decision path,
not merely a note saying a bug was fixed. The tests execute both behavior variants.

## Payment: discount and provider results

Both versions reject an original price that is not a positive safe integer. The
before version then goes to the gateway boundary. The after version checks whether
a discount was supplied. No discount follows the normal gateway path.

With a discount, open **Payment → Discount → Eligibility → Subscription**. Discount
requires an active subscription and an integer percentage from 0 to 100. Rejection
returns Invalid discount and does not silently charge full price. Acceptance returns
the calculated amount to Payment. If that amount is zero, access is granted without
visiting the gateway; a positive amount uses the ordinary payment path.

At the gateway boundary, pending or absent results remain waiting. A timeout permits
another supplied result; no further result remains waiting. Cancellation and decline
have separate outcomes. A reported payment must also pass the verification decision
before reaching Payment accepted. Failed verification is a failure even when the
gateway reported payment.

The waiting loops express successive supplied results, not busy polling or a
required retry policy for a real provider. The fixture reports `waiting` when input
results are exhausted; the map's wait state represents that pending outcome.
Provider internals are explicitly outside the reviewed scope.

## Chat: synchronous result to background work

Chat opens the shared Subscription process and stops if access is inactive. In the
before version it reads a response-service result and returns a reply or an error.
In after, it first queues the work, then observes job results. Pending or unavailable
results enter Wait for job completion. Only a ready result delivers a reply; a
failed result ends in an error. Queueing never means the response has completed.

The response-service boundary belongs to the synthetic user's application. It does
not introduce an AI provider or API requirement into LogicAtlas.

## Honest gaps and preserved content

- Usage reporting is an unreviewed, unknown process with no invented nodes or edges.
- Reply translation is planned only, with an explicit source-unspecified reason;
  no implemented path invokes it.
- Subscription has one definition shared by Chat and Discount Eligibility.
- `subscription.json`, `analytics.json`, and `translation.json` are byte-identical
  between before and after. Changed processes retain preexisting node/edge IDs.
- The root overview has no artificial relationships between independent scenarios.

## Independent comprehension check

Give a reviewer only the map documents and this format guide, without application
source. Ask them to explain: why login retries or stops; why a fully discounted
purchase avoids the gateway; why paid-but-unverified fails; how queued chat differs
from a delivered reply; which child is shared; and which area is unknown or planned.

Compare their explanation with the walkthroughs above and record misconceptions.
This independent human check is **not yet run**. Automated tests exercise the fixture
behaviors and critical map changes but cannot replace this acceptance criterion.
