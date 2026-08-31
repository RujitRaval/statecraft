# Security Policy

## Supported versions

Before the external cutover, security fixes target the latest commit on `main`. After the first UIWitness publication, fixes target the latest published UIWitness release and `main`; older releases may not receive fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue for suspected vulnerabilities, leaked credentials, or sensitive report contents.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. Maintainers will acknowledge a valid report as soon as practical and coordinate disclosure after a fix is available.

## Sensitive output

UIWitness reports may contain application screenshots and diagnostics. Keep `.uiwitness/` and any legacy `.statecraft/` evidence out of version control, and review report artifacts before sharing them. UIWitness never migrates, uploads, or deletes the legacy evidence root automatically.
