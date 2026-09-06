# Public identity decision

Date checked: 2026-09-06

## Requested identity

- Display name: **VibeShield**
- npm package: `vibeshield` (unscoped)
- CLI binary: `vibeshield`
- OpenAI/Codex plugin ID: `vibeshield`
- Primary Agent Skill: `vibeshield`
- MCP server and tool prefix: `vibeshield`

The user explicitly requested this identity for the zero-friction product migration. This source
decision does not reserve a package, establish ownership, authorize publication, or provide legal
clearance.

## Unscoped npm package check

The exact command `npm view vibeshield --json` queried `https://registry.npmjs.org/vibeshield` on
2026-09-06 and returned npm `E404 Not Found`. No registered exact package was visible at that time.

This is a point-in-time availability observation only:

- npm availability is independent of GitHub repository availability.
- `E404` does not reserve the name or guarantee publish permission.
- The exact name must be checked again immediately before any authorized first publish.
- If npm reports an existing or protected package, publication must stop. No scoped fallback is
  authorized.

## Active security-market uses

The VibeShield name has multiple active uses in or adjacent to the security market, including:

- <https://vibeshield.org/> — security scanner for AI-generated apps
- <https://www.vibe-shield.com/> — security scanner for vibe-coded apps
- <https://vibeshield.net/> and <https://vibe-shield.net/> — web security scanning uses
- <https://vibeshield.tech/> — secure architecture/developer product use
- a Chrome Web Store extension named VibeShield
- VibeSHIELD DDoS protection offered by VibeGAMES

These are meaningful collision signals. No exclusivity, trademark clearance, freedom to operate, or
lack of consumer confusion is claimed. A legal/brand review remains an operator decision before
commercial publication. This warning must remain in public release handoff material until the user
explicitly resolves the name decision.

## Controlled migration

| Surface             | Previous public candidate | Requested target       |
| ------------------- | ------------------------- | ---------------------- |
| Display name        | InvariantSec              | VibeShield             |
| npm package         | `invariantsec`            | `vibeshield`           |
| Primary binary      | `invariantsec`            | `vibeshield`           |
| Plugin              | `invariantsec`            | `vibeshield`           |
| Public Agent Skills | four specialist skills    | one `vibeshield` skill |
| Configuration       | `.invariantsec.json`      | `.vibeshield.json`     |

The legacy `invariantsec` binary alias and `.invariantsec.json` loader remain for migration
compatibility. Stable `AS-*` security rule IDs remain unchanged so reports, suppressions, and
baselines do not churn solely because of branding.

## Publication decision

**NOT READY FOR PUBLICATION.** Local artifact verification can proceed, but no publication is
authorized. Before publication, recheck the exact unscoped npm coordinate, explicitly review the
active market uses, configure the external repository/npm governance gates, and verify the live
registry commands. If the exact unscoped npm identity cannot legitimately be used, stop and obtain
the user's explicit approval for a different aligned product/package name.
