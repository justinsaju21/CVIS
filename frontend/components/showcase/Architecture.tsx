"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wifi, Database, Brain, ArrowRight, Layers, ShieldCheck, Activity } from "lucide-react";
import { tokens, cardStyle } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function Architecture() {
    const [active, setActive] = useState(0);

    const layers = [
        {
            icon: <Zap size={28} />,
            title: "1. Edge Client / TCU",
            tech: "ESP32 Embedded / Dual-Core 240MHz",
            desc: "The vehicle's thin telematics gateway. Continuously synthesizes 17-parameter physical telemetry (SOC, voltage, motor current, cell temperatures, tire pressures) across 8 operating modes and computes cryptographic signatures in hardware.",
            metrics: [
                { label: "Hardware Core", val: "ESP32-WROOM-32" },
                { label: "Physics Parameters", val: "17 Simulated Channels" },
                { label: "Operating Modes", val: "8 Emergent Profiles" },
                { label: "Power Draw", val: "< 1.5W Average" },
            ],
            details: ["mbedTLS HMAC-SHA256", "Debounced GPIO ISR", "Hardware RNG IV for AES-GCM", "Adaptive Telemetry Intervals"]
        },
        {
            icon: <Wifi size={28} />,
            title: "2. Secure Transport Layer",
            tech: "Runtime HTTP REST ⇄ MQTT v5.0",
            desc: "Dual-protocol communication pipeline switchable at runtime from NOC with zero downtime. Enforces constant-time HMAC payload authentication, AES-256-GCM confidentiality, and 30-second sliding-window replay protection.",
            metrics: [
                { label: "Protocol Agility", val: "HTTP ⇄ MQTT Runtime" },
                { label: "Ingest Latency", val: "3.1ms (MQTT) / 6.2ms (HTTP)" },
                { label: "Wire Integrity", val: "HMAC-SHA256 (Constant-Time)" },
                { label: "Confidentiality", val: "AES-256-GCM AEAD" },
            ],
            details: ["Zero-Downtime Adapter Bridge", "Replay Monotonic Filter", "QoS 1 Broker Acknowledgement", "Canonical JSON Serialization"]
        },
        {
            icon: <Database size={28} />,
            title: "3. Centralized Cloud Core",
            tech: "FastAPI + SQLite WAL + ASGI Chaos",
            desc: "The centralized data-center engine. Intercepts frames through ASGI Chaos Middleware (packet loss, latency injection, payload tampering), commits multi-factor snapshots to SQLite Write-Ahead Logging, and fans out updates over WebSockets.",
            metrics: [
                { label: "API Framework", val: "FastAPI / Uvicorn ASGI" },
                { label: "Database Engine", val: "SQLite (WAL Mode)" },
                { label: "Chaos Middleware", val: "Loss / Latency / Tamper" },
                { label: "WebSocket Fan-Out", val: "< 1.0 ms Latency" },
            ],
            details: ["Chaos Engineering Middleware", "40,000+ Packets Logged", "Dynamic Kill-Switch Control", "Full Device Registration Flow"]
        },
        {
            icon: <Brain size={28} />,
            title: "4. Centralized AI Hub",
            tech: "CUDA Accelerated Ollama (RTX 4060)",
            desc: "High-throughput neural reasoning layer. Offloads 100% of Llama-3.2:3b layers to dedicated NVIDIA RTX 4060 GPU VRAM, evaluating 17 simultaneous telemetry dimensions in sub-300ms without threshold rules.",
            metrics: [
                { label: "Acceleration Engine", val: "NVIDIA RTX 4060 (8GB VRAM)" },
                { label: "Inference Speed", val: "96.7 tokens / sec" },
                { label: "Prompt Reasoning", val: "17 Multi-Factor Inputs" },
                { label: "Fallback Cache", val: "< 4.5ms Deterministic Engine" },
            ],
            details: ["100% CUDA Offload (num_gpu: 99)", "Telemetry Grounded Chat", "Dynamic Model Switcher API", "Deterministic AI Cache Engine"]
        }
    ];

    return (
        <section id="architecture" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
            <SectionHeading
                pill="System Design"
                title="Four-Tier Modular"
                gradientText="Architecture"
                subtitle="Engineered for high-frequency telematics, cryptographic verification, and resilient cloud reasoning."
            />

            {/* Layer selector tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 28 }}>
                {layers.map((layer, i) => (
                    <motion.div
                        key={i}
                        onClick={() => setActive(i)}
                        whileHover={{ y: -4 }}
                        style={{
                            ...cardStyle,
                            padding: "20px 22px",
                            cursor: "pointer",
                            borderColor: active === i ? tokens.colors.cyan : tokens.colors.border,
                            background: active === i ? "rgba(0, 242, 254, 0.05)" : tokens.colors.cardBg,
                            transition: "all 0.3s ease",
                        }}
                    >
                        <div style={{ color: active === i ? tokens.colors.cyan : tokens.colors.textMuted, marginBottom: 14 }}>
                            {layer.icon}
                        </div>
                        <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{layer.title}</h3>
                        <p style={{ color: tokens.colors.cyan, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase" }}>{layer.tech}</p>
                    </motion.div>
                ))}
            </div>

            {/* Active layer detailed card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        ...cardStyle,
                        padding: "36px",
                        background: "rgba(255, 255, 255, 0.02)",
                    }}
                >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }} className="grid-cols-1 md:grid-cols-2">
                        <div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(0,242,254,0.1)", borderRadius: 6, marginBottom: 16 }}>
                                <span style={{ color: tokens.colors.cyan, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>TIER 0{active + 1} DEEP DIVE</span>
                            </div>
                            <h3 style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginBottom: 12 }}>{layers[active].title}</h3>
                            <p style={{ color: tokens.colors.textSecondary, fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
                                {layers[active].desc}
                            </p>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {layers[active].details.map((d, j) => (
                                    <span
                                        key={j}
                                        style={{
                                            fontSize: 12,
                                            background: "rgba(255,255,255,0.06)",
                                            padding: "6px 14px",
                                            borderRadius: 8,
                                            color: tokens.colors.cyan,
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            fontWeight: 600,
                                        }}
                                    >
                                        ✓ {d}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Metrics grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {layers[active].metrics.map((m, k) => (
                                <div
                                    key={k}
                                    style={{
                                        padding: "18px",
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        borderRadius: 12,
                                    }}
                                >
                                    <div style={{ color: tokens.colors.textMuted, fontSize: 11, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>
                                        {m.label}
                                    </div>
                                    <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>
                                        {m.val}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </section>
    );
}
