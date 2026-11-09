"use client";

import React from "react";
import Navbar from "@/components/showcase/Navbar";
import Hero from "@/components/showcase/Hero";
import ProblemSolution from "@/components/showcase/ProblemSolution";
import Architecture from "@/components/showcase/Architecture";
import Economics from "@/components/showcase/Economics";
import GapsMitigations from "@/components/showcase/GapsMitigations";
import CaseStudies from "@/components/showcase/CaseStudies";
import DashboardPreview from "@/components/showcase/DashboardPreview";
import TechStack from "@/components/showcase/TechStack";
import Footer from "@/components/showcase/Footer";
import { tokens, cardStyle } from "@/components/showcase/Styles";
import { Presentation, Play, ExternalLink, ShieldCheck, Cpu } from "lucide-react";
import Link from "next/link";

export default function ShowcasePage() {
    return (
        <main style={{
            background: tokens.colors.bg,
            color: tokens.colors.textPrimary,
            minHeight: "100vh",
            overflowX: "hidden",
            fontFamily: "var(--font-inter), system-ui, sans-serif"
        }}>
            {/* Top Navigation */}
            <Navbar />

            {/* Hero Section */}
            <Hero />

            {/* Presentation Callout Banner */}
            <div style={{ maxWidth: 1200, margin: "-40px auto 40px", padding: "0 24px" }}>
                <div style={{
                    ...cardStyle,
                    padding: "28px 36px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 20,
                    background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(0,242,254,0.06) 100%)",
                    border: "1px solid rgba(168,85,247,0.25)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(168,85,247,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <Presentation size={24} color="#d8b4fe" />
                        </div>
                        <div>
                            <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                                Interactive Academic Slide Deck (20 Slides)
                            </h3>
                            <p style={{ color: tokens.colors.textSecondary, fontSize: 14 }}>
                                Full-screen presentation viewer with exact viva presentation headers, examiner traps, and unit economics.
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/showcase/ppt"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 24px",
                            background: "linear-gradient(135deg, #a855f7 0%, #4facfe 100%)",
                            color: "#fff",
                            borderRadius: 10,
                            fontWeight: 800,
                            fontSize: 14,
                            textDecoration: "none",
                            boxShadow: "0 0 25px rgba(168,85,247,0.3)"
                        }}
                    >
                        <Play size={16} fill="#fff" />
                        Launch Presentation PPT
                    </Link>
                </div>
            </div>

            {/* Problem & Solution (Philosophy) */}
            <ProblemSolution />

            {/* 4-Tier Modular Architecture */}
            <Architecture />

            {/* Industrial Economics ($1B BOM Savings) */}
            <Economics />

            {/* Critical Gaps & Mitigations */}
            <GapsMitigations />

            {/* Real-World Case Studies (Tesla, Rivian, NIO) */}
            <CaseStudies />

            {/* Live Dashboard Portals Preview */}
            <DashboardPreview />

            {/* Technology Stack */}
            <TechStack />

            {/* Footer */}
            <Footer />
        </main>
    );
}
