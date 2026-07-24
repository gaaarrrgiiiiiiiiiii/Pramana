# Pramana — Data Retention & Privacy Policy

**System:** Pramana Karnataka Police Investigative Co-Pilot  
**Version:** 3.0.0  
**Effective Date:** July 2026  
**Classification:** Internal — Law Enforcement Use Only

---

## 1. Data Collected

Pramana records the following per user session:

| Data Category | Where Stored | Purpose |
|--------------|-------------|---------|
| Query text (natural language) | `messages.query` | Session replay, audit |
| AI-generated answer | `messages.answer_english` | Session replay |
| Intent classification | `messages.intent` | System analytics |
| Confidence score | `messages.confidence` | Quality monitoring |
| Answer feedback (👍/👎) | `messages.feedback` | Continuous improvement |
| Session metadata | `sessions` table | Session grouping |
| Every API action | `activity_log` table | Security audit trail |
| IP address | `activity_log.ip_address` | Security, abuse prevention |

---

## 2. Data Retention Schedule

| Table | Retention Period | Auto-Delete |
|-------|-----------------|-------------|
| `messages` | 365 days | ✅ Enforced via cron |
| `sessions` | 365 days | ✅ Cascades with messages |
| `activity_log` | 90 days | ✅ Enforced via cron |
| `fir_raw` (source data) | Permanent | ❌ Source of record |

> Officers may request early deletion of their own sessions via the "Delete Session" button in the Audit History portal. Deletion is permanent and non-reversible.

---

## 3. Access Controls

- **Field Officers** — read/write access to their own sessions only
- **Inspectors** — read access to sessions of Field Officers in their district
- **SCRB Analysts / DGP** — read access to all sessions statewide
- **System logs (activity_log)** — SCRB Analyst access only via `/api/activity-log`

No user at any level can modify another user's session content. Deletion of another user's session requires SCRB Analyst role + explicit confirmation.

---

## 4. What Is NOT Stored

- No biometric data
- No original FIR document images or attachments
- No personal identifying information of accused/victims beyond what is already in the FIR dataset
- No user passwords in plaintext (bcrypt hashed)

---

## 5. Data Deletion Requests

An individual officer may delete their own sessions:
- **Via UI:** Audit History → Select session → Delete (trashes the session + all messages in that session)
- **Via API:** `DELETE /api/sessions/{session_id}` (authenticated, own sessions only)

SCRB Analysts may delete any session for compliance purposes.

---

## 6. Incident Response

If a data access incident is detected:
1. Disable the affected user account immediately (`/api/admin/disable-user`)
2. Query `activity_log` for all actions by that user in the last 90 days
3. Notify the district DGP within 24 hours

---

## 7. Compliance Notes

This system processes government law enforcement data. All data handling must comply with:
- IT Act 2000 (India)
- Karnataka Police Act 1963
- Any applicable state-level data governance directives

This policy is reviewed annually or upon any major system change.
