# Private source provenance

The initial public source tree was exported with `git archive` from an internally verified
development commit. It was not cloned from the private development repository, and no private Git
objects, refs, branches, tags, remotes, reflogs, or author metadata were imported.

Before public-name or privacy changes, a path-and-Git-blob comparison covered 597 files. It found
zero missing files, zero extra files, and zero content mismatches. Windows archive extraction does
not preserve a separately inspectable Git executable-mode manifest, so this result establishes
path/content equivalence rather than a cross-filesystem mode guarantee.

The exact private commit mapping is intentionally retained only in local release-gate evidence. It
is not needed by users and does not form part of the public Git lineage.
