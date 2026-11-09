"use client";
import React from "react";
import { motion } from "framer-motion";
import { XCircle, CheckCircle2, TrendingDown, DollarSign, Zap, BatteryCharging, ShieldAlert, Cpu } from "lucide-react";
import { tokens, cardStyle } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function ProblemSolution() {
    const problems = [
        { title: "BOM Cost Inflation", desc: "$1,735 – $3,520 per EV in localized edge AI silicon, liquid cooling, and ASIL-D packaging." },
        { title: "Phantom Sentry Drain", desc: "150W–250W continuous edge compute burns 3.6 kWh/day, losing 15 miles of driving range while parked." },
        { title: "Hardware-Software Mismatch", desc: "Vehicles last 15 years; edge neural chips become computationally obsolete in 18 months." },
        { title: "High-Risk ECU OTA Flashing", desc: "Flashing 4–8 GB model weights over cellular risks bricked ECUs and auxiliary battery exhaustion." },
        { title: "Siloed Local Heuristics", desc: "Isolated edge AI cannot detect systemic cell tab weld defects across manufacturing batches." },
    ];

    const solutions = [
        { title: "Ultra-Thin Gateway ($37 – $92)", desc: "Saves $1.00 Billion USD in annual manufacturing BOM costs for an OEM producing 500,000 EVs." },
        { title: "Zero Phantom Drain (<1.5W)", desc: "100x lower auxiliary power draw eliminates phantom battery drain while parked at airports or driveways." },
        { title: "30-Second Zero-Downtime Swaps", desc: "Cloud model weights update in data centers instantly without a single byte of vehicle flash memory wear." },
        { title: "Fleet-Wide Anomaly Clustering", desc: "Cross-correlates battery cell resistance deltas across thousands of vehicles to catch batch defects weeks early." },
        { title: "Cryptographic Zero-Trust Pipe", desc: "Every telemetry frame is verified in constant-time using HMAC-SHA256 and optional AES-256-GCM AEAD." },
    ];

    return (
        <section id="philosophy" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
            <SectionHeading
                pill="The Architectural Thesis"
                title="Industrial Dilemma &"
                gradientText="The CVIS Paradigm"
                subtitle="Why global EV automakers are abandoning localized edge AI chips in favor of centralized cloud telematics."
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 28 }}>
                {/* Legacy Problem Card */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    style={{
                        ...cardStyle,
                        padding: 36,
                        border: `1px solid ${tokens.colors.red}33`,
                        background: "rgba(248, 113, 113, 0.02)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                        <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: "rgba(248, 113, 113, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <XCircle color={tokens.colors.red} size={22} />
                        </div>
                        <div>
                            <h3 style={{ color: tokens.colors.red, fontSize: 18, fontWeight: 800 }}>Localized In-Car Edge AI</h3>
                            <p style={{ color: tokens.colors.textMuted, fontSize: 12, fontFamily: "monospace" }}>LEGACY AUTOMOTIVE APPROACH</p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {problems.map((p, i) => (
                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                <span style={{ color: tokens.colors.red, fontWeight: 900, marginTop: 2 }}>✕</span>
                                <div>
                                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{p.title}</div>
                                    <div style={{ color: tokens.colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{p.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* CVIS Solution Card */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    style={{
                        ...cardStyle,
                        padding: 36,
                        border: `1px solid ${tokens.colors.green}33`,
                        background: "rgba(16, 185, 129, 0.03)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                        <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: "rgba(16, 185, 129, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <CheckCircle2 color={tokens.colors.green} size={22} />
                        </div>
                        <div>
                            <h3 style={{ color: tokens.colors.green, fontSize: 18, fontWeight: 800 }}>CVIS Decoupled Centralized Hub</h3>
                            <p style={{ color: tokens.colors.cyan, fontSize: 12, fontFamily: "monospace" }}>PROVEN CCNS ARCHITECTURE</p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {solutions.map((s, i) => (
                            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                <span style={{ color: tokens.colors.green, fontWeight: 900, marginTop: 2 }}>✓</span>
                                <div>
                                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{s.title}</div>
                                    <div style={{ color: tokens.colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{s.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
