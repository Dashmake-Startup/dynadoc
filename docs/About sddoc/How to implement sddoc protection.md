Recommended hybrid architecture (best practical protection)

Keep core secret ops off the client when possible

Put sensitive keys and signing on a server / license service. The server issues short-lived keys or signed tokens used by the client to open .sddoc.

Offline use? Provide cached, time-limited tokens tied to a device identity (see (4)).

Use native (Rust) binary for what must run on client

Move encryption / decryption implementation into a compiled Rust binary or native module. Strip symbols, enable LTO, and apply obfuscation/anti-tamper tools if desired.

The JS app becomes a thin wrapper calling the native binary.

Use asymmetric signing, not just symmetric secrets

Have the server sign .sddoc metadata (or a license blob) with a private key. The client verifies the signature with an embedded public key.

For encrypted content: encrypt with a per-file symmetric key, and protect that key by wrapping it with server operations or by using a device-bound secret.

Bind access to device/user (device attestation)

Use platform key stores (macOS Keychain, Windows DPAPI/TPM, Linux keyrings) or TPM / Secure Enclave to bind a key to the device.

Combine this with per-install ID so tokens issued by server are valid only on that device.

License server for enforcement and audits

A license / entitlement server enables revocation, expiration, and per-user limits. Even if an attacker reimplements the format, they can’t get valid server tokens unless they compromise the server or the device-specific secret.

Signed formats & tamper detection

Add signatures or HMACs to .sddoc chunks so modified or forged files are rejected.

Include weakly-unique watermarks / traces to detect unauthorized re-distributors.

Legal + licensing

Use a clear commercial license for the closed parts (Rust binary + server usage). Make the .sddoc format proprietary in license terms and assert copyright.

Use copyright, contract terms, and pursue violators — legal remedies deter many.