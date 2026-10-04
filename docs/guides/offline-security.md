---
title: Offline behavior, cache and security
description: Offline behavior, cache and security for Localisync applications.
sidebar:
  order: 5
---

Bundled text is available before I/O. Startup loads and re-verifies persistent cache, then performs one bounded update check. Later checks require `refresh()`; no focus, reconnect, resume or polling listeners are installed.

## Integrity and identity

Channel/release manifests require trusted Ed25519 JOSE signatures. Locale files require exact SHA-256 and byte length. Project, distribution, channel, release, locale and strict SemVer must agree. Unknown signing keys and protocol versions fail closed. The highest verified catalog revision persists; a lower revision or different content at the same revision is rejected. A higher revision may legitimately select an older release during rollback.

ETag requests reuse only a corresponding verified catalog. Failover keeps the selected release and file digests fixed. Fetch omits cookies and rejects redirects. Production uses HTTPS; the explicit development exception accepts only loopback HTTP and never disables TLS verification.

## Worker and CSP

Host the matching module worker on your origin. Permit that path with `worker-src` and the two public delivery origins with `connect-src`. The SDK needs no `unsafe-eval`, inline code evaluation, external fonts or vendor scripts. Distribution CORS must allow the application origin. Read keys travel in the Authorization header, never URLs.

If worker creation fails, existing messages continue working and status reports `worker`. Fix the URL, MIME type or CSP and retry. Heavy parsing is not moved to the main thread as a fallback.

## Persistent storage

IndexedDB stores content-addressed files separately from generation metadata. A transaction commits the files and active/previous references together after verification; downloads do not hold a transaction open. The database schema is version 2; earlier inline generation records remain readable and migrate on the next content commit. Another tab cannot commit a lower or conflicting catalog revision. Locale and manual activation preferences remain instance-local.

Node uses a private local directory with an exclusive writer lease. Content-addressed files complete and sync before the small generation record is atomically renamed. Active and previous file references survive cleanup; orphaned files from an interrupted commit are pruned on a later successful write. Await `dispose()` before reusing its directory. Do not share that directory across active runtimes or use a network filesystem. A crashed process can be recovered; ambiguous live locks produce a storage diagnostic.

The default budget per delivery scope is 256 MiB and includes metadata and distinct content files referenced by both the active and previous generation. Shared files are counted once; temporary disk overhead and browser engine bookkeeping can require additional space. Cache quota/permission errors do not prevent verified in-memory use, but `persisted` remains false. Signed cache is rechecked at startup. Invalid active data can recover from a valid previous generation; otherwise bundled text remains available.

Browser storage may be cleared by the user or OS. The SDK does not cache the application's HTML or JavaScript shell; use your application's offline strategy for that. Revoking a read key stops future authorized downloads, not text already stored on an offline device.

## Limits and recovery

The protocol caps a release at 10,000 keys, 50,000 values and 100 MiB, with a 1 MiB catalog. Values are limited to 16 KiB, with 32 ICU parameters, 10 expression levels and 1,000 nodes. Duplicate JSON properties, invalid UTF-8 and prototype-pollution property names are rejected.

`authorization`: confirm channel scope and node key-policy activation. `verification`: inspect release/signing configuration; never disable verification. `compatibility`: check the application SemVer and generated contracts. `storage`: check quota/permissions and writer ownership. `locale`: publish/prepare the requested locale. Retrying does not erase the current translation view.

The storage transaction lifecycle follows the [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB); a successful cache write is reported only after its transaction completes.

## Operational diagnostics

[Monitoring and error references](/operations/monitoring/) explains safe request references, private logs/traces and failure recovery. [Optional SDK diagnostics](/operations/sdk-diagnostics/) remain off unless the application explicitly configures a write-only diagnostic key. A reporting outage does not change verified translations or the publication commit boundary.
