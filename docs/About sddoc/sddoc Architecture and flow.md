

This architecture represents a "Military-Grade" Freemium Desktop strategy. It ensures that the **Electron** frontend is just a "painter" for the UI, while the **Go Middleware** acts as a "Secure Vault" and **Go Backend** acts as the "Root of Trust."

---

### 1. The Pro Architecture Layers

* **Electron (Open Source):** Handles user interactions and rendering. It communicates with the middleware via a local-only authenticated REST or gRPC stream.
* **Go Middleware (Closed Binary):** The local gatekeeper. It holds the Machine ID, manages the AES-GCM encryption, and verifies the **Cryptographic Lease**.
* **Go Backend (Closed Source):** The authority. It manages subscriptions, issues signed leases, and holds the Master Private Key for rotating the PKI.

---

### 2. The Integrated Security Flow

#### Phase A: The "Fueling" (First Login/Renewal)

This is the only phase that requires internet.

1. **Identity Verification:** Middleware sends user credentials and the **Unique Machine ID** to the Backend.
2. **Lease Issuance:** The Backend verifies the subscription and generates a **Cryptographic Lease**.
* *Payload:* `UserID`, `MachineID`, `ExpiryDate (Current + 30 Days)`, `PlanType`.
* *Signature:* Signed with the Backend's Private Key.


3. **Key Distribution:** The Backend sends the **Global Public Read Key** and a **User-Specific Signing Key**.
4. **Local Locking:** Middleware saves these in the **OS Keychain** and an **Encrypted Local Cache** (using a key derived from the hardware, never stored on disk).

#### Phase B: The Offline "Work" Period (The 30-Day Window)

The user can now disconnect from the internet entirely.

1. **Validation:** Every time a file is touched, the Middleware checks the local Lease. It uses the hardcoded **Backend Public Key** to verify the signature hasn't been tampered with.
2. **Clock-Skew Protection:** The Middleware tracks the "Last Document Access Time." If the system clock is ever *earlier* than the last recorded time, the Middleware blocks access (preventing users from freezing time to extend their 30 days).

#### Phase C: The .sddoc Lifecycle

This handles the "Universal Read, Restricted Write" requirement.

* **Universal Reading (Guests & Pros):**
1. Electron requests to open a file.
2. Middleware uses the **Global Public Read Key** to unlock the **DEK (Document Encryption Key)**.
3. Middleware decrypts the payload in RAM and streams the "Safe" JSON to Electron.


* **Restricted Saving (Pros Only):**
1. Electron sends modified data to Middleware.
2. Middleware checks the **Offline Lease**.
3. **If Valid:** Middleware encrypts the data and applies a **Digital Signature** using the User's Signing Key.
4. **If Invalid/Expired:** Middleware returns a `402 Payment Required` code. Electron shows the "Connect to Internet to Renew" popup.


#### Phase D: Web/Mobile Server-Side Flow (Online)

Web and mobile cannot rely on the local middleware, so the backend performs the `.sddoc` pack/unpack on the server.

1. **RPC Gate:** The client calls `/api/ipc/invoke` with `ddocify` or `unddocify`. The request must include a valid auth token.
2. **Server Pack/Unpack:** The backend uses the same `.sddoc` envelope format and keys to encrypt/decrypt.
3. **Write Paywall:** If the user lacks the `editor.sddoc` entitlement, the backend returns `402 Payment Required`.
4. **User Prompt:** Web/mobile show a "Connect to Internet to Renew" message and block the save.

**Server Requirements (Web/Mobile):**
* `GLOBAL_READ_PUBLIC_KEY` and `GLOBAL_READ_PRIVATE_KEY` must be configured on the backend.
* `SDDOC_SIGNING_PRIVATE_KEY_PATH` and `SDDOC_SIGNING_PUBLIC_KEY_PATH` must point to the server signing keypair.
* The signing private key never leaves the backend.


---

### 3. The .sddoc Data Structure (Envelope Encryption)

The file is structured so that 3rd party tools cannot modify it without breaking the "Seal."

| Offset | Component | Encryption | Purpose |
| --- | --- | --- | --- |
| `0x00` | **Header** | Plaintext | Magic Bytes & Versioning. |
| `0x10` | **Key Slot** | RSA/ECC (Public Key) | Contains the DEK; allows anyone with the Public Key to read. |
| `0x60` | **Metadata** | AES-GCM | Encrypted file properties (Author, Created Date). |
| `0x120` | **Payload** | **AES-256-GCM** | The actual `.xddoc` data. |
| `EOF` | **Signature** | HMAC/Ed25519 | **Integrity:** Proves only a Pro-authorized binary wrote this file. |

---

### 4. Summary of Business Protections

1. **No "Hackable" Electron:** Even if a user modifies the JavaScript to set `isPro = true`, the Go Middleware will refuse to sign the `.sddoc` because it lacks a valid **Cryptographic Lease** signed by your server.
2. **Hardware Bound:** Because the local cache is encrypted with a key derived from the **Machine ID**, a user cannot copy their "active session" to a friend's computer.
3. **Tamper-Proof Files:** If a user tries to edit the `.sddoc` in a Hex Editor, the **Digital Signature** at the end of the file will fail verification, and the Middleware will refuse to load the "corrupted" data.
4. **Universal Accessibility:** By distributing the Public Key freely, your `.sddoc` files remain a portable format that anyone can view, driving "Free" users toward your app.

**Would you like me to provide the Go implementation for the "Clock-Skew" detection to ensure the 30-day offline limit is strictly enforced?**





OLD


This architecture represents a "Pro" Enterprise strategy. It balances **high-security token management**, **hardware-locked encryption**, and a **freemium "Read-Only" document model**.

### 1. The Global Architecture Layer

We divide the system into three distinct zones of trust: the OS Keychain (High Trust), the Local File System (Medium Trust), and the Application Memory (Runtime).

---

### 2. Security Component Breakdown

| Component | Security Mechanism | Purpose |
| --- | --- | --- |
| **Identity Secrets** | OS Keychain (macOS/Win/Linux) | Stores `AccessToken` and `RefreshToken`. |
| **Storage Key** | Derived Machine ID (HMAC-SHA256) | Encrypts local fallbacks so they can't be moved to other PCs. |
| **Auth Metadata** | AES-256-GCM Encrypted JSON | Stores Profile and the **30-Day Offline Lease**. |
| **Document (.sddoc)** | Envelope Encryption + Digital Signature | Allows universal reading but restricts "Saving" to Pro users. |

---

### 3. The "Pro" Logic Flow (Step-by-Step)

#### Phase A: The Secure Handshake (App Startup)

1. **Derive Machine Key:** App generates a key from hardware UUIDs (not stored on disk).
2. **Decrypt Metadata:** App opens `auth-session.json`.
3. **Check Lease:** * If `CurrentTime < OfflineDeadline`, the app enters **"Full Feature Mode"**.
* If `CurrentTime > OfflineDeadline` and **Offline**, the app enters **"Guest/Read-Only Mode"**.


4. **Silent Sync (If Online):** The app uses the `RefreshToken` from the Keychain to ask Casdoor: *"Is this user still Pro?"* If yes, it slides the `OfflineDeadline` forward by 30 days.

#### Phase B: The Document Lifecycle (.xddoc vs .sddoc)

* **Opening/Reading:**
* The app extracts the `DEK` (Document Encryption Key) using an embedded "Shared Read Key."
* **Everyone** can view the contents of the archive.


* **Modifying:**
* Edits happen in RAM. The app tracks a `isModified` flag.


* **Saving (The Paywall):**
* The app calls `ValidateAccess()`.
* **If Non-Subscriber:** Save is blocked. A "Subscription Required" modal appears.
* **If Subscriber:** The app re-encrypts the `.xddoc` into an `.sddoc` and signs it with the user's private key to guarantee integrity.



---

### 4. Implementation Blueprint (Go)

This unified logic ensures your app remains secure even in headless or offline scenarios.

```go
// 1. The "Gatekeeper" that controls the Save feature
func CanUserSave() bool {
    session, _ := readProSession() // Decrypts metadata using MachineKey
    
    // Check 1: Identity
    if !session.Authenticated { return false }
    
    // Check 2: Subscription Status
    if !session.SubscriptionActive { return false }
    
    // Check 3: The 30-Day "Office-Style" Lease
    if time.Now().After(session.OfflineDeadline) {
        // Force an online check if possible, otherwise block
        return tryOnlineLeaseRenewal(session) 
    }
    
    return true
}

// 2. The Secure Document Wrapper
func SaveSddoc(path string, data []byte) error {
    if !CanUserSave() {
        return errors.New("PRO_SUBSCRIPTION_REQUIRED")
    }
    
    // Generate random DEK
    dek := make([]byte, 32)
    rand.Read(dek)
    
    // Encrypt the archive
    encryptedBody, _ := aesGCMEncrypt(data, dek)
    
    // Sign the file so it's a "Verified Pro Document"
    signature, _ := signWithHardwareKey(encryptedBody)
    
    // Final Bundle: [Header][EncryptedDEK][EncryptedBody][Signature]
    return writeToDisk(path, encryptedBody, signature)
}

```

---

### 5. Why this is "Business Level"

* **Offline Resilience:** Your users can go on a 2-week business trip with no internet, and the app will never lock them out of "Save" because the `OfflineDeadline` was cached securely.
* **Tamper Proof:** Because the metadata is encrypted with a **Machine-Specific Key**, a user cannot "hack" their own local files to turn themselves into a Pro user.
* **Hardware Binding:** By using the Keychain and Hardware UUIDs, you prevent "Account Sharing" where one user pays and 100 people copy the config files.

### Next Step

To finalize this, would you like the **Go code for the specific Machine ID collectors** (the ones for macOS, Windows, and Linux) so your encryption key is perfectly deterministic for each OS?
