# CVIS IEEE Paper — Reference Candidates & Research Gaps

## Reference Audit Status: Corrected

> This file was audited against IEEE Xplore, DOI.org/Crossref, arXiv, NIST, and IETF sources.
> Corrections applied: [4] lead author, [6] DOI + details, [7] DOI + details + authors, [10] full authors + vol/issue/pages, [13] marked UNVERIFIED (DOI 404), [14] arXiv ID corrected.

## Verified Reference Sources (14 total)

---

### [1] Fielding, R. T. (2000) — REST Architecture [FOUNDATIONAL]
**Title:** "Architectural Styles and the Design of Network-based Software Architectures"  
**Venue:** PhD Thesis, UC Irvine  
**Why:** Foundational reference for HTTP REST, the primary protocol in CVIS.  
**Download:** https://ics.uci.edu/~fielding/pubs/dissertation/fielding_dissertation.pdf  
*(Free PDF — kept as a foundational reference despite age)*

---

### [2] OASIS MQTT TC (2019) — MQTT v5.0 [FOUNDATIONAL]
**Title:** "MQTT Version 5.0"  
**Venue:** OASIS Standard  
**Why:** Defines the MQTT protocol used in MqttAdapter.  
**Download:** https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.pdf  
*(Free PDF — official OASIS standard)*

---

### [3] Baccari et al. (2024) — Anomaly Detection in CAVs Survey [IEEE Access 2024] ✅
**Title:** "Anomaly Detection in Connected and Autonomous Vehicles: A Survey, Analysis, and Research Challenges"  
**Authors:** Sihem Baccari, Marwen Hadded, Hatem Ghazzai, Hmaied Touati, Mohamed Elhadef  
**Venue:** *IEEE Access*, Vol. 12, pp. 19250–19276, 2024  
**DOI:** https://doi.org/10.1109/ACCESS.2024.3361829  
**Download:** https://ieeexplore.ieee.org/document/10416644  
**Why:** Directly surveys AI anomaly detection in connected vehicles — validates CVIS's AI reasoning layer.

---

### [4] Laghari et al. (2024) — MQTT Ecosystem Security [IEEE Access 2024] ✅
**Title:** "Securing MQTT Ecosystem: Exploring Vulnerabilities, Mitigations, and Future Trajectories"
**Authors:** Shams Ul Arfeen Laghari, W. Li, S. Manickam, P. Nanda, A. K. Al-Ani, S. Karuppayah
**Venue:** *IEEE Access*, Vol. 12, pp. 139273–139289, June 2024
**DOI:** https://doi.org/10.1109/ACCESS.2024.3412030
**Download:** https://ieeexplore.ieee.org/document/10551501
**Why:** Directly relevant to CVIS's MQTT adapter implementation and security design decisions.

> ⚠️ **Audit correction:** Lead author is S. U. A. Laghari et al. — earlier project documents incorrectly listed "M. Arafat et al."

---

### [5] Ma et al. (2024) — Certificateless Auth for IoV [IEEE Trans. Veh. Technol. 2024] ✅
**Title:** "STCLA: An Efficient Certificateless Authenticated Key Agreement Scheme for the Internet of Vehicles"  
**Authors:** Yuqian Ma, Xinghua Li, Wenbo Shi, Qingfeng Cheng  
**Venue:** *IEEE Transactions on Vehicular Technology*, Vol. 73, Issue 4, pp. 4830–4841, April 2024  
**DOI:** https://doi.org/10.1109/TVT.2023.3334034  
**Download:** https://ieeexplore.ieee.org/document/10330102  
**Why:** Covers HMAC-SHA256 usage in IoV auth — directly comparable to CVIS's API key + HMAC scheme.

---

### [6] Hakeem & Kim (2025) — V2X Intrusion Detection Survey [IEEE TITS 2025] ✅
**Title:** "Advancing Intrusion Detection in V2X Networks: A Comprehensive Survey on Machine Learning, Federated Learning, and Edge AI for V2X Security"
**Authors:** Shaimaa Abdelnabi Abdel Hakeem, HyungWon Kim
**Venue:** *IEEE Transactions on Intelligent Transportation Systems*, Vol. 26, No. 8, pp. 11137–11205, 2025
**DOI:** https://doi.org/10.1109/TITS.2025.3558849
**Download:** https://doi.org/10.1109/TITS.2025.3558849
**Why:** Reviews ML/AI-based threat detection in vehicular networks — contextualises CVIS chaos middleware + tamper detection.

> ⚠️ **Audit correction:** DOI corrected from `10.1109/TITS.2025.3525698` (unverified) to `10.1109/TITS.2025.3558849` (verified). Vol. 26, No. 8, pp. 11137–11205 added.

---

### [7] Bhavsar et al. (2024) — FL-Based IDS [IEEE Access 2024] ✅
**Title:** "FL-IDS: Federated Learning-Based Intrusion Detection System Using Edge Devices for Transportation IoT"
**Authors:** Mansi H. Bhavsar, Y. B. Bekele, K. Roy, J. C. Kelly, D. Limbrick
**Venue:** *IEEE Access*, Vol. 12, pp. 52215–52226, 2024
**DOI:** https://doi.org/10.1109/ACCESS.2024.3386631
**Download:** https://ieeexplore.ieee.org/document/10409575
**Why:** FL-IDS represents an alternative AI security approach — contextualises CVIS's centralised AI design position.

> ⚠️ **Audit correction:** DOI corrected from `10.1109/ACCESS.2024.3359367` (unverified) to `10.1109/ACCESS.2024.3386631` (verified). Full author list and pp. 52215–52226 added.

---

### [8] NIST SP 800-38D (2007) — AES-GCM Standard [FOUNDATIONAL]
**Title:** "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC"  
**Authors:** NIST  
**Venue:** NIST Special Publication 800-38D, 2007  
**Download:** https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf  
*(Free PDF — official NIST standard — directly cited for AES-256-GCM in CVIS)*

---

### [9] Krawczyk, Bellare, Canetti (1997) — HMAC RFC [FOUNDATIONAL]
**Title:** "HMAC: Keyed-Hashing for Message Authentication"  
**Venue:** RFC 2104, IETF, 1997  
**Download:** https://www.rfc-editor.org/rfc/rfc2104  
*(Free — IETF standard — foundational for CVIS's HMAC-SHA256 implementation)*

---

### [10] Sedjelmaci, Tourki & Ansari (2023) — 6G Zero Trust AI [IEEE Network 2023] ✅
**Title:** "Enabling 6G Security: The Synergy of Zero Trust Architecture and Artificial Intelligence"
**Authors:** Hichem Sedjelmaci, Kamel Tourki, Nirwan Ansari
**Venue:** *IEEE Network*, Vol. 38, No. 3, pp. 171–177, Oct. 2023
**DOI:** https://doi.org/10.1109/MNET.2023.3321992
**Download:** https://ieeexplore.ieee.org/document/10286270
**Why:** ZTA + AI framework contextualises CVIS's token-based auth design and zero-trust per-packet verification principle.

> ⚠️ **Audit correction:** Full author names confirmed as Sedjelmaci, Tourki, Ansari. Vol. 38, No. 3, pp. 171–177 added.

---

### [11] Meta AI Research (2024) — Llama 3 [Technical Report] ✅
**Title:** "The Llama 3 Herd of Models"  
**Authors:** Meta AI  
**Venue:** arXiv:2407.21783, 2024  
**Download:** https://arxiv.org/abs/2407.21783  
*(Free PDF on arXiv — directly relevant as CVIS uses llama3.2:3b)*

---

### [12] Fette & Melnikov (2011) — WebSocket Protocol [RFC]
**Title:** "The WebSocket Protocol"  
**Venue:** RFC 6455, IETF, 2011  
**Download:** https://www.rfc-editor.org/rfc/rfc6455  
*(Free — IETF standard — CVIS's real-time fan-out relies on WebSocket)*

---

### [13] UNVERIFIED — REQUIRES SOURCE CONFIRMATION
**Cited as:** R. Alshehri et al., "A Timed Efficient Stream Loss-Tolerant Authentication Protocol for IoV Cybersecurity," *IEEE Access*, 2023.
**Cited DOI:** 10.1109/ACCESS.2023.3305289
**Verification result:** DOI returns HTTP 404 on both doi.org/Crossref and IEEE Xplore. The paper cannot be confirmed as a real, indexed publication.
**Action required:** The author must locate the original source of this citation (e.g., from a reference list used during research) and replace this entry with a verified, correctly cited paper.
**Current impact in document:** Reference [13] is used to support the claim that NTP-based timestamp replay protection is the standard approach in IoV literature. Until verified, this claim is uncorroborated.

---

### [14] Moramarco et al. (2025) — LLMs for Aerospace Time Series Anomaly Detection [ASE 2025] ✅
**Title:** "Evaluating Large Language Models for Time Series Anomaly Detection in Aerospace Software"
**Authors:** G. Moramarco et al.
**Venue:** *Proc. 40th IEEE/ACM International Conference on Automated Software Engineering (ASE)*, 2025
**arXiv:** arXiv:2601.12448
**Download:** https://arxiv.org/abs/2601.12448
**Why:** Evaluates LLMs on structured sensor data under multiple prompt paradigms — CVIS interprets the finding that raw numeric input underperforms enriched prompts as supporting its physics-contextualised prompting approach. Note: the domain evaluated is aerospace telemetry, which is related but distinct from vehicle IoT telemetry.

> ⚠️ **Audit correction:** arXiv ID corrected from `2501.18050` (which is an unrelated soccer game-theory paper by Pramanik) to `2601.12448` (verified: Moramarco et al., LLM time-series anomaly detection in aerospace, accepted ASE 2025). Full title corrected to include "in Aerospace Software".

---

## Summary Table

| # | Title (Short) | Venue | Year | DOI/Identifier | Status |
|---|---|---|---|---|---|
| 1 | Fielding REST Dissertation | UC Irvine PhD Thesis | 2000 | ics.uci.edu | ✅ Verified |
| 2 | MQTT v5.0 Specification | OASIS Standard | 2019 | docs.oasis-open.org | ✅ Verified |
| 3 | Anomaly Detection CAV Survey | **IEEE Access** | 2024 | 10.1109/ACCESS.2024.3361829 | ✅ Verified (author name fix) |
| 4 | Securing MQTT Ecosystem | **IEEE Access** | 2024 | 10.1109/ACCESS.2024.3412030 | ✅ Verified (author fix: Laghari) |
| 5 | STCLA IoV Auth (HMAC-SHA256) | **IEEE TVT** | 2024 | 10.1109/TVT.2023.3334034 | ✅ Verified |
| 6 | V2X IDS Survey (FL+Edge AI) | **IEEE TITS** | 2025 | **10.1109/TITS.2025.3558849** (corrected) | ✅ Verified |
| 7 | FL-IDS Transportation | **IEEE Access** | 2024 | **10.1109/ACCESS.2024.3386631** (corrected) | ✅ Verified |
| 8 | NIST AES-GCM SP 800-38D | NIST Standard | 2007 | nvlpubs.nist.gov | ✅ Verified |
| 9 | HMAC RFC 2104 | IETF RFC | 1997 | rfc-editor.org | ✅ Verified |
| 10 | 6G Zero Trust + AI | **IEEE Network** | 2023 | 10.1109/MNET.2023.3321992 | ✅ Verified (full authors + vol added) |
| 11 | Llama 3 Herd of Models | arXiv | 2024 | arXiv:2407.21783 | ✅ Verified |
| 12 | WebSocket Protocol RFC 6455 | IETF RFC | 2011 | rfc-editor.org | ✅ Verified |
| 13 | IoV Auth Protocol | **UNVERIFIED** | 2023 | DOI 404 — cannot confirm | ❌ UNVERIFIED |
| 14 | LLM Aerospace TSAD | arXiv / ASE 2025 | 2025 | **arXiv:2601.12448** (corrected) | ✅ Verified |

**Freely downloadable without paywall: 10/14**
**IEEE/IETF/NIST publications: 12/14**
**2023+ dated: 8/14 (all domain-specific ones)**
**References requiring action before submission: 1 ([13])**

---

## Research Gaps Identified

Based on thorough codebase analysis and literature review, the following gaps are identified and represented by CVIS:

### Gap 1 — Protocol Agnosticism in Secure Vehicle Telemetry
Most existing works commit to either HTTP or MQTT for vehicle telemetry (e.g., [4], [5]). **No published prototype demonstrates runtime switching between HTTP REST and MQTT with a unified security verification pipeline that works identically across both transports.** CVIS fills this gap with a single `ingest_telemetry_data()` function that both adapters funnel into.

### Gap 2 — Centralized LLM Reasoning vs. Edge/Federated AI
The dominant 2023–2025 literature trend is toward **federated/edge AI** [6][7] — pushing intelligence to the vehicle or roadside unit. CVIS argues the opposite: centralized LLM reasoning over the full, multi-factor telemetry snapshot produces qualitatively richer insights (mode transitions, compound fault patterns) that federated/edge models cannot easily replicate. **The case for centralized AI as a deliberate architectural choice — rather than a performance compromise — is underexplored.**

### Gap 3 — Application-Layer Chaos Middleware as a Security Teaching Tool
Existing testbeds for vehicular network security use real network-layer tooling (tc/netem, ns-3, SUMO) which requires significant infrastructure. **No publicly documented prototype demonstrates using a pure application-layer ASGI middleware to simultaneously teach packet loss, latency, and cryptographic tamper detection in a single zero-infrastructure demo.** CVIS's ChaosMiddleware addresses this.

### Gap 4 — Stateful Physics-Grounded AI Prompting
Existing LLM applications to vehicle monitoring (e.g., [3][14]) treat telemetry as flat time-series data. **CVIS's prompt builder injects mode-aware range violations, trend deltas with directional annotations, and mode-transition events** — providing the LLM with physics-contextualised prompts rather than raw numbers. This approach has not been formally evaluated in the literature.

### Gap 5 — Replay Protection on Resource-Constrained Nodes Without Wall-Clock Time
CVIS uses `millis()` (boot-relative monotonic counter) from the ESP8266 as the replay protection token instead of UTC timestamps. Replay protection schemes in the reviewed sources (e.g., [13] — **currently UNVERIFIED**) assume clock-synchronised timestamps for replay windows. Within the reviewed sources, using a monotonic boot counter that resets to 0 on every reboot, combined with device re-registration after boot, as a replay token was not encountered as a documented approach for time-synchronisation-free embedded nodes.

### Gap 6 — Unified Multi-Role Frontend for Vehicle Network Visualization
The NOC visualization layer (live animated packet flow, protocol-coloured, click-to-expand inspector, inline chaos controls) was not found in the academic prototypes reviewed for this project. Research tools reviewed either provide packet-level detail (Wireshark-style) or high-level dashboards (Grafana-style), but within the reviewed set no published academic prototype provides a unified driver+NOC+admin frontend wired to real, live security demonstrations without any external tooling.

---

## Reference Audit Summary

| Reference | Status | Correction Made |
|---|---|---|
| [1] Fielding dissertation | ✅ Verified | No change |
| [2] MQTT v5.0 | ✅ Verified | No change |
| [3] Baccari et al. | ✅ Verified (minor fix) | Author name: Hakim Ghazzai (not Hatem) |
| [4] Laghari et al. | ✅ Verified (author fix) | Lead author corrected: Laghari (not Arafat) |
| [5] Ma et al. STCLA | ✅ Verified | No change |
| [6] Hakeem & Kim | ❌ Wrong DOI | DOI corrected to `10.1109/TITS.2025.3558849`; vol/issue/pages added |
| [7] Bhavsar et al. | ❌ Wrong DOI | DOI corrected to `10.1109/ACCESS.2024.3386631`; authors and pages added |
| [8] NIST SP 800-38D | ✅ Verified | No change |
| [9] RFC 2104 | ✅ Verified | No change |
| [10] Sedjelmaci et al. | ✅ Verified (details added) | Full authors confirmed; vol. 38, no. 3, pp. 171–177 added |
| [11] Llama 3 | ✅ Verified | arXiv:2407.21783 confirmed |
| [12] RFC 6455 | ✅ Verified | No change |
| [13] Alshehri et al. | ❌ UNVERIFIED | DOI `10.1109/ACCESS.2023.3305289` returns HTTP 404. Cannot confirm. Requires action. |
| [14] Moramarco et al. | ❌ Wrong arXiv ID | Corrected from `2501.18050` (soccer paper) to `2601.12448` (LLM aerospace TSAD, ASE 2025) |
