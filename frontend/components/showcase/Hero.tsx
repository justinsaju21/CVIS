"use client";
import React from "react";
import { motion } from "framer-motion";
import { ExternalLink, Activity, Cpu, Wifi, Brain, Shield, Play, Layers } from "lucide-react";
import Link from "next/link";
import { tokens, gradientText, cardStyle } from "./Styles";

export default function Hero() {
    const features = [
        { icon: <Activity color={tokens.colors.cyan} size={22} />, title: "Real-Time Telemetry", desc: "40,000+ Packets Ingested", value: "Sub-10ms" },
        { icon: <Brain color={tokens.colors.purple} size={22} />, title: "Centralized Cloud AI", desc: "NVIDIA RTX 4060 GPU", value: "96.7 tok/s" },
        { icon: <Wifi color={tokens.colors.blue} size={22} />, title: "Dual Protocol Agility", desc: "HTTP REST ⇄ MQTT v5.0", value: "Runtime Toggle" },
        { icon: <Shield color={tokens.colors.green} size={22} />, title: "Zero-Trust Wire Crypto", desc: "Constant-Time HMAC & AES", value: "100% Verified" },
    ];

    return (
        <section
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                padding: "140px 24px 80px",
            }}
        >
            {/* Radial glow background */}
            <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.16, 0.08] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: "absolute",
                    top: "12%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 950,
                    height: 950,
                    background: `radial-gradient(circle, ${tokens.colors.cyan}33 0%, ${tokens.colors.purple}15 40%, transparent 70%)`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1140, textAlign: "center", width: "100%" }}>
                {/* Status badge */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        ...cardStyle,
                        padding: "8px 22px",
                        borderRadius: 999,
                        marginBottom: 32,
                    }}
                >
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: tokens.colors.green,
                        boxShadow: `0 0 10px ${tokens.colors.green}`,
                        display: "inline-block"
                    }} />
                    <span
                        style={{
                            fontSize: 12,
                            color: tokens.colors.textSecondary,
                            fontFamily: "monospace",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                        }}
                    >
                        v3.0 • AUTONOMOUS FLIGHT RECORDER & GPU TELEMATICS ACTIVE
                    </span>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                    style={{
                        fontSize: "clamp(2.6rem, 5.8vw, 5.2rem)",
                        fontWeight: 900,
                        lineHeight: 1.08,
                        marginBottom: 24,
                        letterSpacing: "-0.03em",
                    }}
                >
                    <span style={{ color: "#fff" }}>Connected Vehicle</span>
                    <br />
                    <span style={gradientText}>Intelligence System</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    style={{
                        fontSize: "clamp(1.05rem, 1.8vw, 1.28rem)",
                        color: tokens.colors.textSecondary,
                        maxWidth: 780,
                        margin: "0 auto 40px",
                        lineHeight: 1.6,
                    }}
                >
                    A demonstration of <strong style={{ color: "#fff" }}>centralized cloud AI</strong> and <strong style={{ color: tokens.colors.cyan }}>cryptographically verified telemetry</strong> for connected electric vehicles. Proving why intelligence belongs in the cloud, not embedded on edge silicon.
                </motion.p>

                {/* Action CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginBottom: 64 }}
                >
                    <Link
                        href="/driver"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "14px 28px",
                            background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                            color: "#030712",
                            borderRadius: 12,
                            fontSize: 15,
                            fontWeight: 800,
                            textDecoration: "none",
                            boxShadow: "0 0 30px rgba(0, 242, 254, 0.3)",
                            transition: "all 0.2s",
                        }}
                    >
                        Launch Driver Cockpit <ExternalLink size={16} />
                    </Link>

                    <Link
                        href="/noc"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "14px 28px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#fff",
                            borderRadius: 12,
                            fontSize: 15,
                            fontWeight: 700,
                            textDecoration: "none",
                            transition: "all 0.2s",
                        }}
                    >
                        <Shield size={16} color={tokens.colors.cyan} />
                        Network Ops Center (NOC)
                    </Link>

                    <Link
                        href="/showcase/ppt"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "14px 28px",
                            background: "rgba(168, 85, 247, 0.12)",
                            border: "1px solid rgba(168, 85, 247, 0.3)",
                            color: "#d8b4fe",
                            borderRadius: 12,
                            fontSize: 15,
                            fontWeight: 700,
                            textDecoration: "none",
                            transition: "all 0.2s",
                        }}
                    >
                        <Play size={16} />
                        View 20-Slide PPT
                    </Link>
                </motion.div>

                {/* 4 Feature highlight cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
                    {features.map((feat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + i * 0.08 }}
                            style={{
                                ...cardStyle,
                                padding: "20px",
                                textAlign: "left",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>{feat.icon}</div>
                                <span style={{ fontSize: 11, fontFamily: "monospace", color: tokens.colors.cyan, padding: "2px 8px", background: "rgba(0,242,254,0.08)", borderRadius: 6, fontWeight: 700 }}>
                                    {feat.value}
                                </span>
                            </div>
                            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{feat.title}</div>
                            <div style={{ color: tokens.colors.textSecondary, fontSize: 13 }}>{feat.desc}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
