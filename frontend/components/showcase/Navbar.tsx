"use client";
import React, { useState, useEffect } from "react";
import { Cpu, ExternalLink, Menu, X, Shield, Activity, Sliders, Presentation } from "lucide-react";
import Link from "next/link";
import { tokens } from "./Styles";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Philosophy", href: "#philosophy" },
        { name: "Architecture", href: "#architecture" },
        { name: "Economics ($1B BOM)", href: "#economics" },
        { name: "Mitigations", href: "#mitigations" },
        { name: "Tech Stack", href: "#tech" },
    ];

    return (
        <nav
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                transition: "all 0.3s ease",
                padding: scrolled ? "12px 24px" : "18px 24px",
                borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
                background: scrolled ? "rgba(3, 7, 18, 0.85)" : "transparent",
                backdropFilter: scrolled ? "blur(16px)" : "none",
                WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
            }}
        >
            <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {/* Brand */}
                <Link href="/showcase" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #a855f7 100%)",
                        boxShadow: "0 0 20px rgba(0, 242, 254, 0.35)",
                    }}>
                        <Cpu size={20} color="#030712" />
                    </div>
                    <div>
                        <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6 }}>
                            CVIS <span style={{ color: tokens.colors.cyan, fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "rgba(0,242,254,0.1)", borderRadius: 6 }}>EV TELEMATICS</span>
                        </div>
                    </div>
                </Link>

                {/* Desktop Links */}
                <div style={{ display: "none" }} className="md:flex items-center gap-8">
                    <div style={{ display: "flex", gap: 24 }}>
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                style={{
                                    color: tokens.colors.textSecondary,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    textDecoration: "none",
                                    transition: "color 0.2s"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}
                            >
                                {link.name}
                            </a>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Link
                            href="/showcase/ppt"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 16px",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "#fff",
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 700,
                                textDecoration: "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <Presentation size={15} color={tokens.colors.cyan} />
                            Presentation PPT
                        </Link>

                        <Link
                            href="/driver"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 18px",
                                background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                                color: "#030712",
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 800,
                                textDecoration: "none",
                                boxShadow: "0 0 20px rgba(0, 242, 254, 0.25)",
                                transition: "all 0.2s"
                            }}
                        >
                            Live Cockpit <ExternalLink size={14} />
                        </Link>
                    </div>
                </div>

                {/* Mobile Button */}
                <div className="md:hidden">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                            padding: 8
                        }}
                    >
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown */}
            {isOpen && (
                <div style={{
                    background: "rgba(3, 7, 18, 0.98)",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16
                }}>
                    {navLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            style={{ color: "#fff", fontSize: 16, textDecoration: "none", fontWeight: 500 }}
                        >
                            {link.name}
                        </a>
                    ))}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                        <Link
                            href="/showcase/ppt"
                            onClick={() => setIsOpen(false)}
                            style={{
                                padding: "10px",
                                textAlign: "center",
                                background: "rgba(255,255,255,0.08)",
                                color: "#fff",
                                borderRadius: 8,
                                textDecoration: "none",
                                fontWeight: 600
                            }}
                        >
                            View Presentation PPT
                        </Link>
                        <Link
                            href="/driver"
                            onClick={() => setIsOpen(false)}
                            style={{
                                padding: "10px",
                                textAlign: "center",
                                background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                                color: "#030712",
                                borderRadius: 8,
                                textDecoration: "none",
                                fontWeight: 800
                            }}
                        >
                            Launch Live Cockpit
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
