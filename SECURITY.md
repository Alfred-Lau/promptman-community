# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest release on GitHub | ✅ |
| Older releases | Best effort only |

## Reporting a Vulnerability

Please **do not** open a public GitHub Issue for security vulnerabilities.

Prefer one of the following:

1. [GitHub Private Vulnerability Reporting](https://github.com/Alfred-Lau/promptman-community/security/advisories/new) on this repository (recommended)
2. Email the maintainers via the contact listed on [prompt.solokit.run](https://prompt.solokit.run/)

Include:

- Affected version / commit
- Reproduction steps or PoC (private)
- Impact assessment (data disclosure, RCE, auth bypass, etc.)

We aim to acknowledge reports within **7 days** and to provide a remediation plan or status update within **30 days**. Please allow reasonable time before any public disclosure.

## Scope Notes

- PromptMan is a local-first desktop app. Local data lives on the user's machine under the app data directory.
- Optional cloud sync talks to PromptHub (`prompt.solokit.run`). Report API / account security issues through the same channel above.
- Do not include production secrets, user tokens, or personal data in public issues or PRs.
