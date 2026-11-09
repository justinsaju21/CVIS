"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Shield, LayoutDashboard, ExternalLink, Activity, Wifi, Cpu, Terminal } from "lucide-react";
import Link from "next/link";
import { tokens, cardStyle, gradientText } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function DashboardPreview() {
    const [activeTab, setActiveTab] = useState<"driver" | "noc" | "admin">("driver");

    const dashboards = {
        driver: {
            title: "Driver Cockpit",
            route: "/driver",
            badge: "END-USER TELEMATICS",
            badgeColor: tokens.colors.cyan,
            desc: "Ultra-responsive, driver-focused cockpit rendering high-contrast digital speed, battery SOC %, motor draw, tire pressures, and live Turn-by-Turn navigation instructions.",
            highlights: [
                "Dominant 36px digital speedometer (0–200 km/h) & velocity meter",
                "Grounded AI Driving Advisor powered by centralized Llama-3.2:3b",
                "Turn-by-turn navigation HUD overlay with high-contrast dual-casing polyline",
                "Interactive natural-language voice & text driver chat grounded in 17 metrics",
            ],
            metrics: [
                { label: "Update Rate", val: "1.0s – 5.0s Adaptive" },
                { label: "WebSocket Latency", val: "< 1.0 ms Fan-Out" },
                { label: "AI Advisor Latency", val: "Sub-300ms (GPU)" },
            ]
        },
        noc: {
            title: "Network Operations Center",
            route: "/noc",
            badge: "ENGINEERING & CHAOS SUITE",
            badgeColor: tokens.colors.purple,
            desc: "The nerve center of CVIS. Visualizes animated wire packet flow, displays deep-dive byte inspections, and exposes live interactive chaos middleware sliders.",
            highlights: [
                "Live animated packet stream (ESP32 → Transport → Cloud Core → AI Hub)",
                "Click-to-expand packet inspector: canonical bytes, HMAC status, AES IV",
                "Live Chaos Sliders: Packet Loss (0–25%), Latency (0–1000ms), Payload Tampering",
                "Runtime Protocol Switcher: HTTP/1.1 REST ⇄ MQTT v5.0 with zero restarts",
            ],
            metrics: [
                { label: "Wire Packets Logged", val: "40,000+ Total" },
                { label: "Tamper Rejections", val: "460+ Cryptographic 401s" },
                { label: "Protocol Switch Time", val: "0 ms (Instant)" },
            ]
        },
        admin: {
            title: "Administrator Console",
            route: "/admin",
            badge: "FLEET & HARDWARE OBSERVABILITY",
            badgeColor: tokens.colors.green,
            desc: "Enterprise fleet management console. Features real-time host hardware telemetry (NVIDIA RTX 4060 GPU, VRAM, Temp °C, CPU, RAM), device provisioning, and security audit logs.",
            highlights: [
                "Real hardware meters: NVIDIA GeForce RTX 4060 GPU load %, VRAM MB, Temp °C",
                "Registered vehicle fleet table with active API keys and device secrets",
                "Authentication failure audit logs (HMAC mismatch, API key invalid, expired timestamp)",
                "Dynamic 1-click cloud AI model hot-swapping (Llama-3.2:3b ⇄ Phi-3-mini)",
            ],
            metrics: [
                { label: "Telemetry Snapshots", val: "24,000+ In SQLite WAL" },
                { label: "GPU Offload", val: "35/35 Layers in VRAM" },
                { label: "Fleet Vehicles", val: "Multi-Node Registry" },
            ]
        }
    };

    const current = dashboards[activeTab];

    return (
        <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto", borderTop: `1px solid ${tokens.colors.border}` }}>
            <SectionHeading
                pill="Live Portals"
                title="Unified Frontend"
                gradientText="Control Surfaces"
                subtitle="One single Next.js application powering three role-gated operational surfaces."
            />

            {/* Tab controls */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 36 }}>
                {[
                    { id: "driver", label: "Driver Cockpit (/driver)", icon: <Gauge size={16} /> },
                    { id: "noc", label: "Network Ops Center (/noc)", icon: <Shield size={16} /> },
                    { id: "admin", label: "Admin Console (/admin)", icon: <LayoutDashboard size={16} /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 24px",
                            borderRadius: 12,
                            border: activeTab === tab.id ? `1px solid ${tokens.colors.cyan}` : "1px solid rgba(255,255,255,0.08)",
                            background: activeTab === tab.id ? "rgba(0, 242, 254, 0.1)" : "rgba(255,255,255,0.03)",
                            color: activeTab === tab.id ? "#fff" : tokens.colors.textSecondary,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Preview Card */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    ...cardStyle,
                    padding: 36,
                    background: "rgba(255, 255, 255, 0.02)",
                }}
            >
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 36, alignItems: "center" }} className="grid-cols-1 md:grid-cols-2">
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                color: current.badgeColor,
                                background: `${current.badgeColor}15`,
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontWeight: 700,
                            }}>
                                {current.badge}
                            </span>
                        </div>

                        <h3 style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginBottom: 12 }}>{current.title}</h3>
                        <p style={{ color: tokens.colors.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                            {current.desc}
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                            {current.highlights.map((h, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#cbd5e1" }}>
                                    <span style={{ color: current.badgeColor, fontWeight: 900 }}>•</span>
                                    <span>{h}</span>
                                </div>
                            ))}
                        </div>

                        <Link
                            href={current.route}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 24px",
                                background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                                color: "#030712",
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 800,
                                textDecoration: "none",
                                boxShadow: "0 0 20px rgba(0, 242, 254, 0.25)",
                            }}
                        >
                            Open Live {current.title} <ExternalLink size={15} />
                        </Link>
                    </div>

                    {/* Quick Metric Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {current.metrics.map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: "22px",
                                    borderRadius: 12,
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div style={{ color: tokens.colors.textMuted, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6 }}>
                                    {m.label}
                                </div>
                                <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>
                                    {m.val}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
