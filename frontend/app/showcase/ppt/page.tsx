"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight, ChevronLeft, Home, Cpu, Target, AlertTriangle, Lightbulb, Layers,
    HardDrive, Code2, GitBranch, Brain, Users, Play, CheckCircle2, Rocket, BookOpen, Award, FileText, List, Calendar, Layout, Search, User,
    X, Wifi, Activity, Zap, ThumbsUp, Database, Sun, Moon,
    Thermometer, Shield, Move, Fingerprint, DollarSign, TrendingUp, Car, BatteryCharging, ExternalLink, HelpCircle
} from "lucide-react";
import Link from "next/link";

interface Slide {
    id: string;
    type?: "title" | "content";
    icon?: React.ReactNode;
    badge?: string;
    badgeColor?: string;
    title?: string;
    subtitle?: string;
    content: React.ReactNode;
}

const getSlides = (isDark: boolean): Slide[] => [
    // 1. Title Page
    {
        id: "title",
        type: "title",
        content: (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", height: "100%", justifyContent: "center" }}>
                <div style={{
                    padding: "14px 24px",
                    background: isDark ? "rgba(0,242,254,0.1)" : "rgba(2,132,199,0.1)",
                    border: isDark ? "1px solid rgba(0,242,254,0.25)" : "1px solid rgba(2,132,199,0.25)",
                    borderRadius: 99,
                    marginBottom: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12
                }}>
                    <Cpu size={22} color={isDark ? "#00f2fe" : "#0284c7"} />
                    <span style={{ color: isDark ? "#00f2fe" : "#0284c7", fontWeight: 800, letterSpacing: "0.08em", fontSize: 13, textTransform: "uppercase" }}>
                        COMPUTER COMMUNICATION & NETWORK SECURITY (CCNS)
                    </span>
                </div>

                <h1 style={{
                    fontSize: "clamp(2.4rem, 4.5vw, 4.2rem)",
                    fontWeight: 900,
                    lineHeight: 1.1,
                    marginBottom: 20,
                    backgroundImage: isDark ? "linear-gradient(135deg, #fff 0%, #94a3b8 100%)" : "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    letterSpacing: "-0.03em"
                }}>
                    Connected Vehicle Intelligence System<br />
                    <span style={{
                        backgroundImage: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #a855f7 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        Centralized AI & Cryptographic Transport
                    </span>
                </h1>

                <p style={{ fontSize: 18, color: isDark ? "#94a3b8" : "#475569", marginBottom: 48, maxWidth: 740, lineHeight: 1.6 }}>
                    A demonstration of decoupled cloud AI reasoning and cryptographically verified transport protocols for connected electric vehicles.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, width: "100%", maxWidth: 880 }}>
                    {/* Candidate */}
                    <div style={{ textAlign: "right", paddingRight: 36, borderRight: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}>
                        <h3 style={{ color: isDark ? "#4facfe" : "#0284c7", fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                            Project Candidate
                        </h3>
                        <div>
                            <div style={{ color: isDark ? "#fff" : "#0f172a", fontSize: 20, fontWeight: 800 }}>Justin Saju</div>
                            <div style={{ color: isDark ? "#64748b" : "#475569", fontSize: 13, fontFamily: "monospace", marginTop: 4 }}>
                                B.Tech Computer Science & Engineering
                            </div>
                            <div style={{ color: isDark ? "#38bdf8" : "#0284c7", fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>
                                Academic Project — CCNS Course
                            </div>
                        </div>
                    </div>

                    {/* Guide & Domain */}
                    <div style={{ textAlign: "left", paddingLeft: 10, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <h3 style={{ color: isDark ? "#10b981" : "#059669", fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                            Academic Domain
                        </h3>
                        <div>
                            <div style={{ color: isDark ? "#fff" : "#0f172a", fontSize: 18, fontWeight: 800 }}>Computer Networks & Security</div>
                            <div style={{ color: isDark ? "#64748b" : "#475569", fontSize: 14 }}>Department of Networking and Communications</div>
                            <div style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 13, marginTop: 4 }}>Units 1–5 Comprehensive Mapping</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },

    // 2. Contents
    {
        id: "contents",
        icon: <List size={26} />,
        badge: "AGENDA",
        badgeColor: "#a855f7",
        title: "Presentation Contents",
        subtitle: "Twenty-stage structural overview of system architecture, security, economics, and empirical findings.",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                    "Introduction & The Centralized AI Thesis",
                    "Literature Review (Fielding, OASIS, NIST, FIPS)",
                    "Problem Identification & Research Gap (Edge AI Silicon Drawbacks)",
                    "Project Objectives & CCNS Unit 1–5 Mapping",
                    "Three-Tier Decoupled System Architecture",
                    "Hardware & Firmware: ESP32 17-Channel Telemetry Suite",
                    "Methodology: Centralized GPU AI & Multi-Factor Reasoning",
                    "Industrial EV Economics: $1 Billion Annual BOM Savings",
                    "Real-World Industry Parallels (Tesla, Rivian, NIO)",
                    "Security & Cryptography: Constant-Time HMAC & AES-GCM",
                    "Network Resiliency: ASGI Chaos Engineering Middleware",
                    "Project Timeline & 8-Week Phased Development",
                    "Empirical Results: 40,000+ Verified Packets & Replay Engine",
                    "Examiner Trap Questions & Scripted Counter-Tactics",
                    "Future Scope & Industry Roadmap (V2G, ZK-SNARKs)",
                    "Project Conclusion & References"
                ].map((item, i) => (
                    <motion.div
                        key={item}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                            padding: "14px 18px",
                            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                            border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 14
                        }}
                    >
                        <span style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "rgba(168,85,247,0.12)",
                            color: "#a855f7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800
                        }}>{i + 1}</span>
                        <span style={{ color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 14, fontWeight: 600 }}>{item}</span>
                    </motion.div>
                ))}
            </div>
        )
    },

    // 3. Introduction
    {
        id: "intro",
        icon: <BookOpen size={26} />,
        badge: "INTRODUCTION",
        badgeColor: "#00f2fe",
        title: "Introduction",
        subtitle: "The Centralized Cloud AI Architecture Thesis for Connected Electric Vehicles",
        content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ fontSize: 17, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.7 }}>
                    The connected electric vehicle industry is reaching an architectural crossroads. While early attempts sought to embed power-hungry AI processors inside every vehicle chassis, modern telematics requires real-time centralized intelligence. The vehicle is fundamentally a <strong style={{ color: isDark ? "#fff" : "#0f172a" }}>thin, securely networked client</strong>.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div style={{ padding: 24, background: "rgba(239,68,68,0.06)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)" }}>
                        <h3 style={{ color: "#ef4444", fontSize: 17, fontWeight: 800, marginBottom: 10 }}>The Edge AI Deadlock</h3>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 14, lineHeight: 1.6 }}>
                            Embedding 150W–250W edge compute SoCs inflates automotive BOM by $2,000+, induces severe 3.6 kWh/day phantom battery drain while parked, and guarantees vehicle obsolescence in 3 years as neural models evolve.
                        </p>
                    </div>
                    <div style={{ padding: 24, background: "rgba(16,185,129,0.06)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.2)" }}>
                        <h3 style={{ color: "#10b981", fontSize: 17, fontWeight: 800, marginBottom: 10 }}>The CVIS Solution</h3>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 14, lineHeight: 1.6 }}>
                            A high-security, protocol-agnostic transport layer streaming 17 telemetry channels to centralized cloud AI. Enables instant zero-downtime model hot-swapping, zero phantom drain, and cross-fleet anomaly detection.
                        </p>
                    </div>
                </div>
            </div>
        )
    },

    // 4. Literature Review
    {
        id: "litreview",
        icon: <FileText size={26} />,
        badge: "LITERATURE REVIEW",
        badgeColor: "#38bdf8",
        title: "Consolidated Comparative Analysis",
        subtitle: "Academic and industry standards grounding the communication and cryptographic layer",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                    {
                        ref: "RFC 2104 / FIPS 198-1",
                        author: "Krawczyk et al. / NIST",
                        topic: "Keyed-Hashing for Message Authentication (HMAC)",
                        impact: "Provides tamper detection and proof-of-origin on wire frames without public key infrastructure overhead."
                    },
                    {
                        ref: "NIST SP 800-38D",
                        author: "Dworkin (NIST)",
                        topic: "Galois/Counter Mode (AES-GCM AEAD)",
                        impact: "Combines high-speed symmetric encryption with authenticated tag verification; hardware accelerated on ESP32."
                    },
                    {
                        ref: "OASIS MQTT v5.0",
                        author: "OASIS Standard (2019)",
                        topic: "Publish-Subscribe IoT Telemetry Standard",
                        impact: "Minimizes wire framing overhead (185B vs 450B HTTP) and eliminates continuous TCP handshake latency on 4G/5G."
                    },
                    {
                        ref: "Fielding Dissertation",
                        author: "Roy T. Fielding (2000)",
                        topic: "Architectural Styles & Network-based Systems",
                        impact: "Formalizes stateless REST semantics utilized in CVIS for on-demand configuration polling and device provisioning."
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 20, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <div style={{ color: "#00f2fe", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 4 }}>{item.ref}</div>
                        <h4 style={{ color: isDark ? "#fff" : "#0f172a", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{item.topic}</h4>
                        <div style={{ color: isDark ? "#64748b" : "#64748b", fontSize: 12, marginBottom: 8 }}>{item.author}</div>
                        <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 13, lineHeight: 1.5 }}>{item.impact}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 5. Problem & Research Gap
    {
        id: "problem",
        icon: <AlertTriangle size={26} />,
        badge: "PROBLEM & RESEARCH GAP",
        badgeColor: "#ef4444",
        title: "The Critical Disconnect",
        subtitle: "Why edge AI fails automotive economics and engineering constraints",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
                {[
                    {
                        title: "1. BOM Cost Explosion",
                        cost: "$2,000+ Waste",
                        desc: "NVIDIA Orin / Drive Thor modules demand liquid cooling loops, high-amperage DC converters, and ISO 26262 ASIL-D silicon, costing an OEM $1 Billion annually at 500,000 volume."
                    },
                    {
                        title: "2. Parasitic Sentry Drain",
                        cost: "3.6 kWh / Day Lost",
                        desc: "A 150W edge compute processor burns 15 miles of vehicle driving range every 24 hours while parked, degrading high-voltage traction batteries and frustrating vehicle owners."
                    },
                    {
                        title: "3. The OTA Flashing Crisis",
                        cost: "High Bricking Risk",
                        desc: "Flashing 4–8 GB neural network weights over cellular requires flashing low-level ECU ROM partitions, risking bricked customer vehicles and 12V auxiliary battery death during updates."
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 24, background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 14 }}>
                        <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>{item.title}</div>
                        <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 12 }}>{item.cost}</div>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 6. Project Objectives
    {
        id: "objectives",
        icon: <Target size={26} />,
        badge: "PROJECT OBJECTIVES",
        badgeColor: "#10b981",
        title: "Key Targets",
        subtitle: "Concrete academic and engineering targets mapped to CCNS Units 1 through 5",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {[
                    { unit: "Unit 1 & 2: Physical & Transport", target: "Dual Protocol Agility", desc: "Build runtime-switchable HTTP/1.1 REST and MQTT v5.0 transport adapters that switch instantaneously without server reboot or connection drops." },
                    { unit: "Unit 3: Application Protocols", target: "Real-Time Telematics & WebSockets", desc: "Broadcast 17-parameter stateful EV physics frames over persistent WebSockets with sub-1ms fan-out across driver, NOC, and admin portals." },
                    { unit: "Unit 4: Cryptography & Security", target: "Constant-Time Integrity & AEAD", desc: "Enforce constant-time HMAC-SHA256 signature verification and AES-256-GCM authenticated encryption, completely rejecting forged packets." },
                    { unit: "Unit 5: Resiliency & Chaos", target: "Live Chaos Engineering Middleware", desc: "Intercept wire packets using custom ASGI middleware simulating 0–25% packet loss, 0–1000ms latency, and in-flight payload tampering post-signature." },
                ].map((item, i) => (
                    <div key={i} style={{ padding: 22, background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <div style={{ color: "#10b981", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 4 }}>{item.unit}</div>
                        <h4 style={{ color: isDark ? "#fff" : "#0f172a", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{item.target}</h4>
                        <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 13, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 7. System Architecture Block Diagram
    {
        id: "blockdiagram",
        icon: <Layers size={26} />,
        badge: "SYSTEM ARCHITECTURE",
        badgeColor: "#00f2fe",
        title: "Architecture Block Diagram",
        subtitle: "Three-tier decoupled dataflow from thin client to centralized GPU compute",
        content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: 24, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 16, alignItems: "center", textAlign: "center" }}>
                        {/* Tier 1 */}
                        <div style={{ padding: 20, background: "rgba(0,242,254,0.05)", border: "1px solid rgba(0,242,254,0.2)", borderRadius: 12 }}>
                            <div style={{ color: "#00f2fe", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>TIER 1: VEHICLE EDGE</div>
                            <h4 style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>ESP32 Thin Client / TCU</h4>
                            <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 12 }}>17 Channels Telemetry, 8 Vehicle Modes, mbedTLS HMAC-SHA256 & AES-GCM</p>
                        </div>

                        {/* Tier 2 */}
                        <div style={{ padding: 20, background: "rgba(79,172,254,0.05)", border: "1px solid rgba(79,172,254,0.2)", borderRadius: 12 }}>
                            <div style={{ color: "#4facfe", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>TIER 2: CLOUD GATEWAY</div>
                            <h4 style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>FastAPI ASGI Core</h4>
                            <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 12 }}>ASGI Chaos Middleware, Constant-Time Auth, SQLite WAL (40k+ Packets), WebSocket Fan-Out</p>
                        </div>

                        {/* Tier 3 */}
                        <div style={{ padding: 20, background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12 }}>
                            <div style={{ color: "#a855f7", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>TIER 3: AI & FRONTEND</div>
                            <h4 style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>GPU Cluster & Next.js</h4>
                            <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 12 }}>NVIDIA RTX 4060 GPU (96.7 tok/s) + Next.js (/driver, /noc, /admin)</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <div style={{ padding: 12, textAlign: "center", background: "rgba(0,242,254,0.05)", borderRadius: 8, fontSize: 12, color: "#00f2fe", fontWeight: 700 }}>
                        ← Wire: HTTP/1.1 REST or MQTT v5.0 →
                    </div>
                    <div style={{ padding: 12, textAlign: "center", background: "rgba(79,172,254,0.05)", borderRadius: 8, fontSize: 12, color: "#4facfe", fontWeight: 700 }}>
                        ← Persistent WebSockets (&lt; 1ms) →
                    </div>
                    <div style={{ padding: 12, textAlign: "center", background: "rgba(168,85,247,0.05)", borderRadius: 8, fontSize: 12, color: "#a855f7", fontWeight: 700 }}>
                        ← Async Fire-and-Forget Ingest →
                    </div>
                </div>
            </div>
        )
    },

    // 8. Hardware Deployment (17-Sensor Suite)
    {
        id: "hardwaresuite",
        icon: <Zap size={26} />,
        badge: "HARDWARE DEPLOYMENT",
        badgeColor: "#f59e0b",
        title: "17-Sensor Suite: Categories",
        subtitle: "Comprehensive physical telemetry synthesized across 8 emergent vehicle modes",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                    { cat: "High-Voltage Pack", items: ["Battery SOC (0–100%)", "Pack Voltage (300–410V)", "Current Draw (-120A to +300A)", "Pack Internal Resistance"] },
                    { cat: "Thermal Subsystem", items: ["Cell Pack Temp (°C)", "Inverter Ingot Temp (°C)", "Motor Core Temp (°C)", "Cabin HVAC Draw (Watts)"] },
                    { cat: "Dynamics & Tires", items: ["Vehicle Speed (km/h)", "FL Tire Pressure (PSI)", "FR Tire Pressure (PSI)", "RL/RR Tire Pressures"] },
                    { cat: "Diagnostics & Modes", items: ["8 Operating Modes", "Diagnostic Trouble Codes", "Regen Braking %", "Monotonic Timestamp"] },
                ].map((s, i) => (
                    <div key={i} style={{ padding: 20, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <div style={{ color: "#f59e0b", fontSize: 11, fontFamily: "monospace", fontWeight: 800, textTransform: "uppercase", marginBottom: 12 }}>
                            {s.cat}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {s.items.map((it, j) => (
                                <div key={j} style={{ color: isDark ? "#cbd5e1" : "#334155", fontSize: 12, fontWeight: 500 }}>
                                    • {it}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )
    },

    // 9. Methodology (Centralized AI)
    {
        id: "methodology",
        icon: <Brain size={26} />,
        badge: "METHODOLOGY",
        badgeColor: "#a855f7",
        title: "Hybrid Digital Twin Logic",
        subtitle: "Centralized GPU acceleration and multi-factor telemetry prompt engineering",
        content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div style={{ padding: 24, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14 }}>
                        <h4 style={{ color: "#a855f7", fontSize: 15, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
                            GPU Acceleration Profile
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Hardware Engine:</span>
                                <span style={{ color: "#fff", fontWeight: 700 }}>NVIDIA RTX 4060 Laptop GPU</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Layer Offload:</span>
                                <span style={{ color: "#10b981", fontWeight: 700 }}>35/35 Layers in CUDA VRAM</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Evaluation Speed:</span>
                                <span style={{ color: "#00f2fe", fontWeight: 700 }}>96.7 tokens / sec</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Total Inference Latency:</span>
                                <span style={{ color: "#fff", fontWeight: 700 }}>Sub-300ms</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 24, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14 }}>
                        <h4 style={{ color: "#00f2fe", fontSize: 15, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
                            Multi-Factor Prompt Grounding
                        </h4>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                            Strictly satisfies Rule 7 of AGENTS.md: Never simple if/else thresholding. Prompt simultaneously integrates Battery SOC, Pack Voltage, Motor Current, Cell Temp, Ambient Gradient, and Fault DTC codes.
                        </p>
                        <div style={{ padding: 10, background: "rgba(0,242,254,0.08)", borderRadius: 8, fontSize: 12, color: "#00f2fe", fontFamily: "monospace" }}>
                            Prompt = f(Mode, SOC, V_pack, I_draw, T_cell, T_motor, Speed, DTC)
                        </div>
                    </div>
                </div>
            </div>
        )
    },

    // 10. Industrial Economics
    {
        id: "economics",
        icon: <DollarSign size={26} />,
        badge: "INDUSTRIAL FEASIBILITY",
        badgeColor: "#10b981",
        title: "EV Manufacturing Economics",
        subtitle: "$1.00 Billion annual manufacturing BOM savings and 96% SaaS gross margin",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ padding: 24, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14 }}>
                    <div style={{ color: "#10b981", fontSize: 12, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>OEM BALANCE SHEET IMPACT</div>
                    <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginBottom: 12 }}>$1.00 Billion USD Saved</div>
                    <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                        Edge AI SoC module costs <strong>$1,735 – $3,520</strong> vs. CVIS Thin Gateway at <strong>$37 – $92</strong>.
                    </p>
                    <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: "monospace", fontSize: 13, color: "#10b981" }}>
                        ΔBOM = $2,000 / car × 500,000 EVs = $1,000,000,000
                    </div>
                </div>

                <div style={{ padding: 24, background: "rgba(0,242,254,0.05)", border: "1px solid rgba(0,242,254,0.2)", borderRadius: 14 }}>
                    <div style={{ color: "#00f2fe", fontSize: 12, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>SOFTWARE-AS-A-SERVICE (SAAS)</div>
                    <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginBottom: 12 }}>96.0% Gross Margin</div>
                    <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                        Cloud operating cost is <strong>$0.396 / car / month</strong> against a <strong>$9.99 / month</strong> subscription price.
                    </p>
                    <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: "monospace", fontSize: 13, color: "#00f2fe" }}>
                        Gross Margin = ($9.99 - $0.396) / $9.99 = 96.0%
                    </div>
                </div>
            </div>
        )
    },

    // 11. Case Studies
    {
        id: "casestudies",
        icon: <Car size={26} />,
        badge: "INDUSTRY PARALLELS",
        badgeColor: "#38bdf8",
        title: "Real-World Automotive Parallels",
        subtitle: "Production validation across leading electric vehicle manufacturers",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                    {
                        company: "Tesla Inc.",
                        tech: "Fleet Learning & Project Dojo",
                        badge: "TRAINING OFFLOAD",
                        desc: "On-vehicle computers run minimal forward-pass vision. Edge triggers stream disengagement telematics back to Dojo and Cortex GPU supercomputers for centralized learning."
                    },
                    {
                        company: "Rivian Automotive",
                        tech: "AWS FleetOS & Telematics Gateway",
                        badge: "MQTT CLUSTERING",
                        desc: "Rivian vehicles utilize a lightweight custom Telematics Gateway Unit (TGU) communicating over MQTT/WebSockets to AWS FleetOS for battery and suspension modeling."
                    },
                    {
                        company: "NIO Inc.",
                        tech: "Battery-as-a-Service (BaaS)",
                        badge: "CROSS-FLEET HEALTH",
                        desc: "NIO monitors over 40 million cell data points per second in the cloud, predicting battery degradation and impedance drift across 2,000+ automated swap stations."
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 22, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <div style={{ color: "#38bdf8", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>{item.badge}</div>
                        <h4 style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{item.company}</h4>
                        <div style={{ color: "#00f2fe", fontSize: 12, fontFamily: "monospace", marginBottom: 10 }}>{item.tech}</div>
                        <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 13, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 12. Security Implementation
    {
        id: "security",
        icon: <Shield size={26} />,
        badge: "SECURITY & CRYPTOGRAPHY",
        badgeColor: "#00f2fe",
        title: "Constant-Time HMAC & AES-GCM",
        subtitle: "Zero-trust wire verification defeating packet tampering and replay attacks",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ padding: 24, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14 }}>
                    <div style={{ color: "#00f2fe", fontSize: 12, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>INTEGRITY & PROOF OF ORIGIN</div>
                    <h4 style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 10 }}>HMAC-SHA256 Constant-Time</h4>
                    <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                        Every packet computes keyed hash over canonical JSON using provisioned 256-bit secret. Backend verifies with <code style={{ color: "#00f2fe" }}>hmac.compare_digest()</code>, preventing timing side-channel attacks.
                    </p>
                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 8, fontSize: 12, color: "#10b981", fontFamily: "monospace" }}>
                        X-HMAC-Signature = HMAC(device_secret, canonical_json)
                    </div>
                </div>

                <div style={{ padding: 24, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14 }}>
                    <div style={{ color: "#a855f7", fontSize: 12, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>CONFIDENTIALITY & AEAD</div>
                    <h4 style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 10 }}>AES-256-GCM Hardware Encryption</h4>
                    <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                        Hardware RNG produces fresh 96-bit IV per frame. Backend validates the 128-bit authentication tag; any mutated byte immediately raises an <code style={{ color: "#ef4444" }}>InvalidTag</code> exception and HTTP 401.
                    </p>
                    <div style={{ padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 8, fontSize: 12, color: "#a855f7", fontFamily: "monospace" }}>
                        Envelope = {"{ iv, ct, tag }"} (Zero IV Reuse)
                    </div>
                </div>
            </div>
        )
    },

    // 13. Chaos Middleware
    {
        id: "chaos",
        icon: <AlertTriangle size={26} />,
        badge: "NETWORK RESILIENCY",
        badgeColor: "#ef4444",
        title: "ASGI Chaos Engineering Middleware",
        subtitle: "Probabilistic packet loss, latency injection, and in-flight payload tampering",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                    {
                        title: "1. Probabilistic Loss (0–25%)",
                        badge: "EXPONENTIAL RETRIES",
                        desc: "Middleware intercepts HTTP/MQTT requests and returns synthetic 503 Service Unavailable, exercising vehicle backoff algorithms (2^n × jitter)."
                    },
                    {
                        title: "2. Latency Injection (0–1000ms)",
                        badge: "NON-BLOCKING ASYNC",
                        desc: "Asynchronous non-blocking delays (await asyncio.sleep) simulate 3G/satellite network degradation without stalling backend worker threads."
                    },
                    {
                        title: "3. Tamper Injection",
                        badge: "SIGNATURE REJECTION",
                        desc: "Mutates a single byte post-signature (e.g. battery=999%). Proves backend detects HMAC mismatch and logs tamper_detected event with HTTP 401."
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 22, background: "rgba(248,113,113,0.03)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 12 }}>
                        <div style={{ color: "#ef4444", fontSize: 11, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>{item.badge}</div>
                        <h4 style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{item.title}</h4>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 14. Timeline
    {
        id: "timeline",
        icon: <Calendar size={26} />,
        badge: "TIMELINE",
        badgeColor: "#38bdf8",
        title: "Development Phases",
        subtitle: "Rigorous 8-week phased gating contract strictly audited per AGENTS.md",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                    { phase: "Phase 1 (W1–2)", name: "Core Pipeline, HTTP Only", desc: "ESP32 firmware, FastAPI ingest, SQLite persistence, and Driver telemetry view." },
                    { phase: "Phase 2 (W2–3)", name: "Auth + Integrity + MQTT", desc: "Device registration, HMAC-SHA256, AES-GCM, and MQTT runtime protocol switch." },
                    { phase: "Phase 3 (W3–4)", name: "AI Integration", desc: "Ollama Llama-3.2:3b integration, multi-factor prompt builder, and grounded chat." },
                    { phase: "Phase 4 (W4–5)", name: "Network Operations Center", desc: "Animated packet flow, deep packet inspector, and live chaos control sliders." },
                    { phase: "Phase 5 (W5–6)", name: "Admin Console & SaaS Gating", desc: "Hardware meters, registered fleet management, and Free/Pro monetization tier." },
                    { phase: "Phase 6–8 (W6–8)", name: "GPU AI, Hardening & Flight Recorder", desc: "CUDA RTX 4060 GPU offload (96.7 tok/s), 40k+ packet dataset, and 100% replay." },
                ].map((item, i) => (
                    <div key={i} style={{ padding: 16, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 10 }}>
                        <div style={{ color: "#38bdf8", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{item.phase}</div>
                        <h4 style={{ color: isDark ? "#fff" : "#0f172a", fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{item.name}</h4>
                        <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 12, lineHeight: 1.4 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 15. Validated Results
    {
        id: "result",
        icon: <Award size={26} />,
        badge: "VALIDATED RESULTS",
        badgeColor: "#10b981",
        title: "Experimental & Impact Analysis",
        subtitle: "Empirical verification across 40,000+ wire packets and autonomous replay",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                    { label: "Total Wire Packets", val: "40,600+", note: "Inbound & Outbound ACK" },
                    { label: "Telemetry Snapshots", val: "24,300+", note: "17 Channels / Row" },
                    { label: "Cryptographic Tamper Audits", val: "460+", note: "100% Caught & Rejected" },
                    { label: "Replay Acceptance", val: "100%", note: "Dynamic Monotonic Signing" },
                    { label: "Ingest p50 Latency", val: "4.2 ms", note: "FastAPI + SQLite WAL" },
                    { label: "WebSocket Broadcast", val: "< 1.0 ms", note: "Fan-Out to All Portals" },
                    { label: "GPU Inference Speed", val: "96.7 tok/s", note: "CUDA RTX 4060 VRAM" },
                    { label: "AI Cache Fallback", val: "< 4.5 ms", note: "Zero Downtime Guarantee" },
                ].map((s, i) => (
                    <div key={i} style={{ padding: 20, background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <div style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                        <div style={{ color: "#10b981", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{s.val}</div>
                        <div style={{ color: isDark ? "#64748b" : "#475569", fontSize: 11 }}>{s.note}</div>
                    </div>
                ))}
            </div>
        )
    },

    // 16. Examiner Traps
    {
        id: "traps",
        icon: <HelpCircle size={26} />,
        badge: "VIVA STRATEGY",
        badgeColor: "#f59e0b",
        title: "Examiner Traps & Scripted Defenses",
        subtitle: "Bulletproof counter-tactics against tough academic committee objections",
        content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                    {
                        trap: "Trap 1: 'Isn't this just a machine learning classification project?'",
                        defense: "'No. This is a Computer Communication & Network Security (CCNS) project. AI is strictly the application riding on top of a secured transport layer. The primary grading surface is the runtime protocol agility, constant-time HMAC verification, AES-GCM AEAD encryption, and ASGI chaos middleware.'"
                    },
                    {
                        trap: "Trap 2: 'Why not put an NVIDIA Jetson or Raspberry Pi inside every vehicle?'",
                        defense: "'An automotive OEM producing 500,000 EVs would incur $1 Billion in unnecessary BOM hardware costs, 200W of parasitic sentry battery drain (losing 15 miles of range daily), and software obsolescence within 3 years. Centralized cloud AI avoids vehicle hardware churn entirely.'"
                    },
                    {
                        trap: "Trap 3: 'What happens in a tunnel when the car loses connection? Does it crash?'",
                        defense: "'Zero drivability reliance on the cloud. Steering, braking, and CAN bus actuation run 100% locally. The vehicle queues telemetry in a 1,000-frame SPI buffer and uses a pre-warmed cache for route advisories. Safety is completely decoupled.'"
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 18, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(245,158,11,0.3)", borderRadius: 12 }}>
                        <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{item.trap}</div>
                        <div style={{ color: isDark ? "#cbd5e1" : "#334155", fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>{item.defense}</div>
                    </div>
                ))}
            </div>
        )
    },

    // 17. Future Scope
    {
        id: "future",
        icon: <Rocket size={26} />,
        badge: "FUTURE ENHANCEMENTS",
        badgeColor: "#a855f7",
        title: "Future Scope",
        subtitle: "Next-generation automotive protocols and decentralized road security",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {[
                    {
                        title: "1. ISO 15118 Bidirectional V2G Telematics",
                        desc: "Extending the secure transport layer to Vehicle-to-Grid (V2G) bidirectional smart charging, enabling vehicles to securely trade energy back to municipal electrical grids."
                    },
                    {
                        title: "2. Zero-Knowledge Proofs (ZK-SNARKs)",
                        desc: "Cryptographic privacy-preserving proofs enabling vehicles to verify highway toll payments, speed compliance, and battery provenance without exposing GPS trajectories."
                    },
                    {
                        title: "3. 5G Ultra-Reliable Low-Latency (URLLC) Slicing",
                        desc: "Direct integration with telecommunications cellular slicing, guaranteeing dedicated sub-5ms latency pipelines for mission-critical telemetry frames."
                    },
                    {
                        title: "4. Quantum-Resistant ML-KEM / ML-DSA",
                        desc: "Transitioning payload signing and key encapsulation to post-quantum standards (Kyber/Dilithium) to ensure vehicle lifetime security against future quantum decryption."
                    }
                ].map((item, i) => (
                    <div key={i} style={{ padding: 22, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                        <h4 style={{ color: "#a855f7", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{item.title}</h4>
                        <p style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                ))}
            </div>
        )
    },

    // 18. Conclusion
    {
        id: "conclusion",
        icon: <CheckCircle2 size={26} />,
        badge: "CONCLUSION",
        badgeColor: "#10b981",
        title: "Project Conclusion",
        subtitle: "Validating the centralized AI thesis through working, verifiable engineering",
        content: (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: 17, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.7 }}>
                    The Connected Vehicle Intelligence System successfully proves that <strong style={{ color: isDark ? "#fff" : "#0f172a" }}>intelligence belongs centrally in data-center infrastructure</strong> and the vehicle is an ultra-reliable, cryptographically secured thin client.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    <div style={{ padding: 20, background: "rgba(0,242,254,0.05)", border: "1px solid rgba(0,242,254,0.2)", borderRadius: 12 }}>
                        <div style={{ color: "#00f2fe", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>100% Cryptographic Verification</div>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 12, lineHeight: 1.5 }}>
                            Constant-time HMAC-SHA256 and AES-256-GCM AEAD actively reject tampered bytes on the wire.
                        </p>
                    </div>
                    <div style={{ padding: 20, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12 }}>
                        <div style={{ color: "#10b981", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>$1B Annual BOM Savings</div>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 12, lineHeight: 1.5 }}>
                            Decoupling compute eliminates $2,000 per car in silicon and liquid cooling, while delivering 96% SaaS gross margin.
                        </p>
                    </div>
                    <div style={{ padding: 20, background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12 }}>
                        <div style={{ color: "#a855f7", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Runtime Protocol Agility</div>
                        <p style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 12, lineHeight: 1.5 }}>
                            HTTP REST and MQTT v5.0 switch seamlessly at runtime without rebooting client or server daemons.
                        </p>
                    </div>
                </div>
            </div>
        )
    },

    // 19. References
    {
        id: "references",
        icon: <BookOpen size={26} />,
        badge: "REFERENCES",
        badgeColor: "#38bdf8",
        title: "References",
        subtitle: "Key academic literature, cryptographic publications, and protocol specifications",
        content: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                    "R. T. Fielding, 'Architectural Styles and the Design of Network-based Software Architectures,' Ph.D. dissertation, UC Irvine, 2000.",
                    "OASIS Standard, 'MQTT Version 5.0,' OASIS Standard, March 2019.",
                    "M. Dworkin, 'Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM),' NIST SP 800-38D, 2007.",
                    "H. Krawczyk et al., 'HMAC: Keyed-Hashing for Message Authentication,' IETF RFC 2104, 1997.",
                    "S. Baccari et al., 'Anomaly Detection in Connected and Autonomous Vehicles,' IEEE Access, vol. 12, 2024.",
                    "Y. Ma et al., 'STCLA: Certificateless Authenticated Key Agreement for IoV,' IEEE Trans. Veh. Technol., vol. 73, 2024.",
                    "I. Fette and A. Melnikov, 'The WebSocket Protocol,' IETF RFC 6455, 2011.",
                    "Espressif Systems, 'ESP32 Technical Reference Manual: Cryptographic Acceleration,' v4.9, 2023."
                ].map((ref, i) => (
                    <div key={i} style={{ padding: "12px 16px", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontSize: 12, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.5 }}>
                        <span style={{ color: "#00f2fe", fontWeight: 700, marginRight: 6 }}>[{i + 1}]</span>
                        {ref}
                    </div>
                ))}
            </div>
        )
    },

    // 20. Thank You Slide
    {
        id: "thankyou",
        type: "title",
        content: (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", height: "100%", justifyContent: "center" }}>
                <div style={{
                    padding: "14px 24px",
                    background: isDark ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 99,
                    marginBottom: 32,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10
                }}>
                    <Award size={20} color="#10b981" />
                    <span style={{ color: "#10b981", fontWeight: 800, letterSpacing: "0.08em", fontSize: 13, textTransform: "uppercase" }}>
                        DEMONSTRATION READY & AUDITED
                    </span>
                </div>

                <h1 style={{
                    fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                    fontWeight: 900,
                    marginBottom: 20,
                    letterSpacing: "-0.03em",
                    backgroundImage: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #a855f7 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                }}>
                    Thank You & Open for Q&A
                </h1>

                <p style={{ fontSize: 18, color: isDark ? "#94a3b8" : "#475569", maxWidth: 640, marginBottom: 40, lineHeight: 1.6 }}>
                    The live Connected Vehicle Intelligence System is operational across all three role-gated portals with real-time GPU inference and continuous telematics.
                </p>

                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
                    <Link
                        href="/driver"
                        style={{
                            padding: "14px 28px",
                            background: "linear-gradient(135deg, #00f2fe, #4facfe)",
                            color: "#030712",
                            borderRadius: 12,
                            fontWeight: 800,
                            fontSize: 14,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: "0 0 25px rgba(0,242,254,0.3)"
                        }}
                    >
                        Launch Driver Cockpit <ExternalLink size={15} />
                    </Link>
                    <Link
                        href="/noc"
                        style={{
                            padding: "14px 28px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#fff",
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 14,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8
                        }}
                    >
                        Network Ops Center <Shield size={15} color="#00f2fe" />
                    </Link>
                    <Link
                        href="/showcase"
                        style={{
                            padding: "14px 28px",
                            background: "rgba(168,85,247,0.12)",
                            border: "1px solid rgba(168,85,247,0.3)",
                            color: "#d8b4fe",
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 14,
                            textDecoration: "none"
                        }}
                    >
                        Back to Showcase Home
                    </Link>
                </div>
            </div>
        )
    }
];

export default function PresentationViewer() {
    const [current, setCurrent] = useState(0);
    const [isDark, setIsDark] = useState(true);

    const slides = getSlides(isDark);
    const total = slides.length;
    const slide = slides[current];

    const goNext = useCallback(() => {
        setCurrent((prev) => Math.min(prev + 1, total - 1));
    }, [total]);

    const goPrev = useCallback(() => {
        setCurrent((prev) => Math.max(prev - 1, 0));
    }, []);

    // Keyboard listener for ArrowLeft, ArrowRight, Space
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
                e.preventDefault();
                goNext();
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                e.preventDefault();
                goPrev();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext, goPrev]);

    return (
        <div style={{
            minHeight: "100vh",
            background: isDark ? "#030712" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--font-inter), system-ui, sans-serif"
        }}>
            {/* Top Bar */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 32px",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
                flexShrink: 0
            }}>
                <Link
                    href="/showcase"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textDecoration: "none",
                        color: isDark ? "#94a3b8" : "#475569",
                        fontSize: 14,
                        fontWeight: 600
                    }}
                >
                    <Home size={16} /> Back to Showcase
                </Link>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "linear-gradient(135deg, #00f2fe, #4facfe)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        <Cpu size={14} color="#030712" />
                    </div>
                    <span style={{ color: isDark ? "#fff" : "#0f172a", fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>
                        CVIS Telematics
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#00f2fe", padding: "2px 8px", background: "rgba(0,242,254,0.1)", borderRadius: 4 }}>
                        SLIDE PRESENTATION
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button
                        onClick={() => setIsDark(!isDark)}
                        style={{
                            background: "transparent",
                            border: "1px solid " + (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"),
                            borderRadius: "50%",
                            width: 34,
                            height: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isDark ? "#facc15" : "#334155",
                            cursor: "pointer"
                        }}
                        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDark ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>
                        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 3, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", flexShrink: 0 }}>
                <motion.div
                    animate={{ width: `${((current + 1) / total) * 100}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #00f2fe, #4facfe, #a855f7)", borderRadius: "0 2px 2px 0" }}
                />
            </div>

            {/* Slide Content */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 48px", overflow: "hidden" }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        style={{ maxWidth: 1040, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}
                    >
                        {slide.type !== "title" && (
                            <>
                                {/* Badge */}
                                <div style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "6px 16px",
                                    marginBottom: 16,
                                    background: `${slide.badgeColor}12`,
                                    border: `1px solid ${slide.badgeColor}30`,
                                    borderRadius: 999,
                                    alignSelf: "flex-start"
                                }}>
                                    <div style={{ color: slide.badgeColor }}>{slide.icon}</div>
                                    <span style={{ color: slide.badgeColor, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", fontFamily: "monospace" }}>
                                        {slide.badge}
                                    </span>
                                </div>

                                {/* Title */}
                                <h1 style={{
                                    fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)",
                                    fontWeight: 900,
                                    marginBottom: 6,
                                    letterSpacing: "-0.02em",
                                    color: isDark ? "#fff" : "#0f172a"
                                }}>
                                    {slide.title}
                                </h1>
                                {slide.subtitle && (
                                    <p style={{ fontSize: 17, color: isDark ? "#94a3b8" : "#475569", marginBottom: 28 }}>
                                        {slide.subtitle}
                                    </p>
                                )}
                                {!slide.subtitle && <div style={{ marginBottom: 28 }} />}
                            </>
                        )}

                        {/* Content */}
                        {slide.content}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Nav */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 40px",
                borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
                flexShrink: 0
            }}>
                {/* Slide dots */}
                <div style={{ display: "flex", gap: 6 }}>
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            style={{
                                width: i === current ? 24 : 7,
                                height: 7,
                                borderRadius: 4,
                                border: "none",
                                cursor: "pointer",
                                background: i === current ? "linear-gradient(90deg, #00f2fe, #a855f7)" : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"),
                                transition: "all 0.3s ease"
                            }}
                            title={`Jump to Slide ${i + 1}`}
                        />
                    ))}
                </div>

                {/* Arrows */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={goPrev}
                        disabled={current === 0}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                            background: current === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
                            color: current === 0 ? (isDark ? "#333" : "#cbd5e1") : (isDark ? "#fff" : "#0f172a"),
                            cursor: current === 0 ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s"
                        }}
                        title="Previous Slide (ArrowLeft)"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={goNext}
                        disabled={current === total - 1}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            border: "none",
                            background: current === total - 1 ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)") : "linear-gradient(135deg, #00f2fe, #4facfe)",
                            color: current === total - 1 ? (isDark ? "#333" : "#cbd5e1") : "#030712",
                            cursor: current === total - 1 ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            transition: "all 0.2s"
                        }}
                        title="Next Slide (ArrowRight or Space)"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
