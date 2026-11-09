"use client";
import React from "react";
import { motion } from "framer-motion";
import { tokens, cardStyle } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function TechStack() {
    const stacks = [
        {
            cat: "Embedded & Edge",
            color: tokens.colors.green,
            items: ["ESP32 Dual-Core 240MHz", "C++ / Arduino Framework", "mbedTLS Cryptography", "Hardware RNG (TRNG)", "Debounced GPIO Interrupts", "Adaptive Rate Intervals"]
        },
        {
            cat: "Secure Transport",
            color: tokens.colors.cyan,
            items: ["HTTP/1.1 REST Client", "MQTT v5.0 Protocol", "WebSockets (RFC 6455)", "HMAC-SHA256 Signatures", "AES-256-GCM AEAD", "Runtime Protocol Agility"]
        },
        {
            cat: "Cloud Data Center",
            color: tokens.colors.blue,
            items: ["FastAPI (Python 3.12)", "Uvicorn ASGI Server", "SQLite WAL Persistence", "Raw ASGI Chaos Middleware", "Device Registration Flow", "Sub-1ms WebSocket Fan-Out"]
        },
        {
            cat: "Centralized AI & GPU",
            color: tokens.colors.purple,
            items: ["NVIDIA RTX 4060 GPU (8GB)", "CUDA Core Offload (num_gpu: 99)", "Ollama Llama-3.2:3b", "17-Factor Prompt Grounding", "96.7 tok/s Eval Speed", "Deterministic AI Cache"]
        },
        {
            cat: "Unified Frontend",
            color: tokens.colors.amber,
            items: ["Next.js 14 App Router", "React 19 & TypeScript", "Framer Motion Visuals", "Recharts Telematics Graphs", "Leaflet OpenStreetMap HUD", "Single Shared WebSocket Feed"]
        },
    ];

    return (
        <section id="tech" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto", borderTop: `1px solid ${tokens.colors.border}` }}>
            <SectionHeading
                pill="The Engineering Stack"
                title="Built with Modern"
                gradientText="Automotive Tech"
                subtitle="A multi-tier software and hardware ecosystem designed for extreme telemetry throughput and zero-trust security."
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                {stacks.map((s, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        style={{
                            ...cardStyle,
                            padding: "28px",
                            border: `1px solid ${s.color}22`,
                            background: "rgba(255, 255, 255, 0.02)",
                        }}
                    >
                        <h3 style={{
                            color: s.color,
                            fontSize: 12,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontFamily: "monospace",
                            marginBottom: 20
                        }}>
                            {s.cat}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {s.items.map((item, j) => (
                                <div key={j} style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ color: s.color, fontSize: 10 }}>■</span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
