# Security policy

This implementation is a release candidate. It has automated security regression
tests but no independent security audit or completed two-account live private pilot.
Do not claim production certification before the release gates are closed.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/iamseyedalipro/CodeVista/security/advisories/new)
when enabled for this repository. Include a minimal synthetic reproduction,
affected revision, expected/actual behavior, and potential impact. Do not submit
tokens, private map content, production database files, or user credentials.

If GitHub does not offer a private report form, the maintainer must enable a
private channel before receiving sensitive details. Open only a generic public
request asking the maintainer to enable private reporting; do not publish the
vulnerability. Enabling and confirming that channel is an explicit release gate.
Host operators should publish their own private incident contact and backup policy.

## Maintainer response

Triage confidentiality and authorization reports before general feature work.
Reproduce with synthetic repositories, add a regression test, patch supported
versions, and coordinate disclosure with the reporter. Revoke affected host tokens
and rotate secrets if compromise is suspected. Avoid promising a response deadline
that the volunteer maintainers have not agreed to meet.

## Security boundaries

Private reads require current user and GitHub App repository access. Repository
content is untrusted data, not executable code or HTML. Tokens are server-only,
encrypted at rest, and excluded from logs. Private responses are not browser-cache
or CDN content. Reverse proxies and backups are part of the operator's trust
boundary; review [self-hosting](docs/self-hosting.md) and [architecture](docs/architecture.md).

Report authorization bypass, cross-account cache/search leakage, unsafe source
links, OAuth/CSRF defects, private-content logging, and repository-code execution
as security issues. Semantic mistakes in agent-authored diagrams are usually
content quality issues unless they cross a confidentiality or execution boundary.
