# ADR 0001: TypeScript-first core with a Rust migration seam

- Status: accepted for phase one
- Date: 2026-08-30

## Context

The product needs safe parallel repository traversal, strong schemas, portable distribution, and a
future standalone binary. Rust is an excellent long-term fit for those constraints. The first
release, however, must also provide proven JavaScript, TypeScript, and Python syntax analysis. This
environment has Node.js 24 but no usable Rust compiler or Windows linker. Attempts to install the
official Rust toolchain were bounded and failed while downloading the compiler.

Shipping uncompiled Rust would violate the project's evidence-first rule. TypeScript also has a
material phase-one advantage: mature, pure-user-space parsers for the initial language targets and
fast iteration on rule precision and fixture corpora.

## Decision

Phase one uses strict TypeScript on Node.js 22 or newer. The deterministic engine is independent of
the CLI, repository input is never imported or executed, and all external scanner integrations are
ports. Public reports and rule metadata use versioned JSON-compatible schemas.

The architecture keeps a Rust migration seam:

- findings, manifests, fixes, and rule metadata are serialized data contracts;
- analyzers implement narrow interfaces without CLI dependencies;
- repository traversal and mutation are isolated modules;
- no rule depends on Node module loading from the target repository;
- a future Rust kernel can replace traversal and selected analyzers behind the same contracts.

## Consequences

Phase one requires a Node runtime and does not yet provide a true single-file native binary. npm
installation and CI usage are supported. Standalone binaries are ROADMAP until either Node SEA is
proven across the release matrix or the core moves to Rust. Rust remains the preferred phase-two
candidate after the rule corpus and interfaces stabilize.

## Reconsideration trigger

Re-evaluate after the initial corpus has measured precision, or sooner when a cross-platform Rust CI
toolchain is available. The migration must preserve golden JSON/SARIF outputs and fixture behavior.
