"use client";
import React from "react";
import { Cpu, ExternalLink, Shield, Presentation, BookOpen, Layers } from "lucide-react";
import Link from "next/link";
import { tokens } from "./Styles";

export default function Footer() {
    return (
        <footer style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            marginTop: 100,
            background: "rgba(3, 7, 18, 0.95)",
            padding: "60px 24px 40px"
        }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 40,
                    marginBottom: 48,
                }}>
                    {/* Brand column */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                <Cpu size={18} color="#030712" />
                            </div>
                            <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>CVIS Telematics</span>
                        </div>
                        <p style={{ color: tokens.colors.textSecondary, fontSize: 13, lineHeight: 1.6, maxWidth: 320 }}>
                            Connected Vehicle Intelligence System. Demonstrating centralized cloud AI and cryptographically verified telemetry transport for connected electric vehicles.
                        </p>
                    </div>

                    {/* Operational Portals */}
                    <div>
                        <h4 style={{ color: tokens.colors.cyan, fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", fontWeight: 700, marginBottom: 16 }}>
                            Operational Portals
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                            <Link href="/driver" style={{ color: tokens.colors.textSecondary, textDecoration: "none" }}>Driver Cockpit (/driver)</Link>
                            <Link href="/noc" style={{ color: tokens.colors.textSecondary, textDecoration: "none" }}>Network Ops Center (/noc)</Link>
                            <Link href="/admin" style={{ color: tokens.colors.textSecondary, textDecoration: "none" }}>Admin Console (/admin)</Link>
                            <Link href="/showcase/ppt" style={{ color: tokens.colors.cyan, textDecoration: "none", fontWeight: 700 }}>20-Slide PPT Presentation</Link>
                        </div>
                    </div>

                    {/* Academic Scope */}
                    <div>
                        <h4 style={{ color: tokens.colors.cyan, fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", fontWeight: 700, marginBottom: 16 }}>
                            Academic Coursework
                        </h4>
                        <p style={{ color: tokens.colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                            <strong>Course:</strong> Computer Communication & Network Security (CCNS)<br />
                            <strong>Units:</strong> Physical/Link, Transport, Application Protocols, Cryptography, Chaos Resiliency<br />
                            <strong>Candidate:</strong> Justin Saju
                        </p>
                    </div>

                    {/* Security & Verification */}
                    <div>
                        <h4 style={{ color: tokens.colors.cyan, fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", fontWeight: 700, marginBottom: 16 }}>
                            Wire Security
                        </h4>
                        <p style={{ color: tokens.colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                            HMAC-SHA256 constant-time verification, AES-256-GCM AEAD encryption, replay protection, and live ASGI chaos middleware.
                        </p>
                    </div>
                </div>

                <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    paddingTop: 24,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    fontSize: 12,
                    color: tokens.colors.textMuted
                }}>
                    <div>© {new Date().getFullYear()} Connected Vehicle Intelligence System (CVIS). All rights reserved.</div>
                    <div style={{ display: "flex", gap: 16 }}>
                        <Link href="/showcase" style={{ color: tokens.colors.textMuted, textDecoration: "none" }}>Showcase Home</Link>
                        <Link href="/showcase/ppt" style={{ color: tokens.colors.cyan, textDecoration: "none" }}>Interactive Presentation</Link>
                        <a href="https://cvis.justinsaju.me" target="_blank" rel="noopener noreferrer" style={{ color: tokens.colors.textMuted, textDecoration: "none" }}>
                            Live Deployment ↗
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
