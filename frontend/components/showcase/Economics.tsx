"use client";
import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, BatteryCharging, ShieldAlert, Cpu, Sparkles, Building2 } from "lucide-react";
import { tokens, cardStyle, gradientText } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function Economics() {
    const costBreakdown = [
        { item: "Automotive AI SoC (NVIDIA Orin / Drive Thor)", edge: "$1,200 – $2,500", cvis: "---" },
        { item: "LPDDR5 ECC Automotive Memory (16GB–32GB)", edge: "$180 – $380", cvis: "---" },
        { item: "Liquid Cooling Radiator, Pumps & Tubing", edge: "$185 – $340", cvis: "---" },
        { item: "DC-DC High-Amperage Converter (150W–250W)", edge: "$140 – $260", cvis: "---" },
        { item: "Automotive Thin MCU (ESP32 / S32K / STM32)", edge: "---", cvis: "$8.50 – $18.00" },
        { item: "Cellular Telematics Modem (LTE-Cat-M / 5G)", edge: "$40 – $80", cvis: "$16.00 – $38.00" },
        { item: "Hardware HSM Crypto Chip (ATECC608A / mbedTLS)", edge: "---", cvis: "$2.50 – $6.00" },
        { item: "Enclosure, Harness & Passive Heat Shield", edge: "$210 – $420", cvis: "$10.00 – $30.00" },
    ];

    const saasStats = [
        { label: "Cloud Bandwidth / Car / Month", val: "$0.0036", note: "1.5 MB/day @ $0.08/GB" },
        { label: "Database & Ingest Storage", val: "$0.0240", note: "FastAPI + SQLite WAL on c6i" },
        { label: "Centralized GPU Compute Cluster", val: "$0.3680", note: "4x NVIDIA L4 / L40S Tensor Cores" },
        { label: "Total Cloud COGS per Car / Month", val: "$0.3956", note: "Total operating expenditure" },
        { label: "Pro Tier Subscription Price", val: "$9.99", note: "Monthly recurring consumer revenue" },
        { label: "Software Gross Margin", val: "96.0%", note: "$9.59 profit per subscriber / mo", highlight: true },
    ];

    return (
        <section id="economics" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto", borderTop: `1px solid ${tokens.colors.border}` }}>
            <SectionHeading
                pill="Industrial Economics"
                title="The $1.00 Billion OEM Savings &"
                gradientText="96% SaaS Gross Margin"
                subtitle="Financial treatise on why centralized automotive intelligence reshapes automaker unit economics."
            />

            {/* Headline Callout Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 48 }}>
                <motion.div
                    whileHover={{ y: -4 }}
                    style={{
                        ...cardStyle,
                        padding: 32,
                        background: "linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(79, 172, 254, 0.02) 100%)",
                        border: `1px solid ${tokens.colors.cyan}44`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0, 242, 254, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DollarSign color={tokens.colors.cyan} size={24} />
                        </div>
                        <div>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: tokens.colors.cyan, textTransform: "uppercase", fontWeight: 700 }}>ANNUAL MANUFACTURING IMPACT</span>
                            <h3 style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>$1.00 Billion Savings</h3>
                        </div>
                    </div>
                    <p style={{ color: tokens.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                        At an annual production volume of <strong>500,000 electric vehicles</strong>, eliminating unnecessary $2,000 edge AI SoCs and liquid cooling loops yields an immediate <strong>$1,000,000,000 USD</strong> in pure automotive BOM savings.
                    </p>
                </motion.div>

                <motion.div
                    whileHover={{ y: -4 }}
                    style={{
                        ...cardStyle,
                        padding: 32,
                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(0, 242, 254, 0.02) 100%)",
                        border: `1px solid ${tokens.colors.green}44`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <TrendingUp color={tokens.colors.green} size={24} />
                        </div>
                        <div>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: tokens.colors.green, textTransform: "uppercase", fontWeight: 700 }}>RECURRING SOFTWARE REVENUE</span>
                            <h3 style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>96.0% Gross Margin</h3>
                        </div>
                    </div>
                    <p style={{ color: tokens.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                        Cloud operating costs sit at just <strong>$0.396 per vehicle/month</strong>. At a $9.99/mo Pro subscription, an automaker with 100,000 subscribers generates <strong>$959,400 monthly profit</strong> long after initial vehicle sale.
                    </p>
                </motion.div>

                <motion.div
                    whileHover={{ y: -4 }}
                    style={{
                        ...cardStyle,
                        padding: 32,
                        background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(79, 172, 254, 0.02) 100%)",
                        border: `1px solid ${tokens.colors.purple}44`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(168, 85, 247, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <BatteryCharging color={tokens.colors.purple} size={24} />
                        </div>
                        <div>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: tokens.colors.purple, textTransform: "uppercase", fontWeight: 700 }}>ZERO PARASITIC DRAIN</span>
                            <h3 style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>100x Efficiency</h3>
                        </div>
                    </div>
                    <p style={{ color: tokens.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                        CVIS consumes <strong>&lt; 1.5W average</strong> vs. 200W for edge compute chips. Eliminates <strong>3.6 kWh/day phantom sentry drain</strong> (15 miles range lost every 24 hours while parked at airports).
                    </p>
                </motion.div>
            </div>

            {/* Bill of Materials Table */}
            <div style={{ ...cardStyle, padding: "32px", marginBottom: 36, overflowX: "auto" }}>
                <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <Cpu size={20} color={tokens.colors.cyan} />
                    Hardware Bill-of-Materials (BOM) Comparison: Edge AI vs. CVIS Thin Client
                </h3>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.border}`, color: tokens.colors.textMuted, fontFamily: "monospace", textTransform: "uppercase", fontSize: 12 }}>
                            <th style={{ padding: "12px 16px" }}>Subsystem Component</th>
                            <th style={{ padding: "12px 16px", color: tokens.colors.red }}>In-Car Edge AI Module</th>
                            <th style={{ padding: "12px 16px", color: tokens.colors.green }}>CVIS Thin Gateway</th>
                        </tr>
                    </thead>
                    <tbody>
                        {costBreakdown.map((row, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "14px 16px", color: "#fff", fontWeight: 500 }}>{row.item}</td>
                                <td style={{ padding: "14px 16px", color: row.edge === "---" ? tokens.colors.textMuted : tokens.colors.red, fontFamily: "monospace" }}>{row.edge}</td>
                                <td style={{ padding: "14px 16px", color: row.cvis === "---" ? tokens.colors.textMuted : tokens.colors.green, fontFamily: "monospace", fontWeight: 700 }}>{row.cvis}</td>
                            </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${tokens.colors.border}`, background: "rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "16px", color: "#fff", fontWeight: 800 }}>Total Hardware BOM Cost per Vehicle</td>
                            <td style={{ padding: "16px", color: tokens.colors.red, fontFamily: "monospace", fontWeight: 900, fontSize: 16 }}>$1,735 – $3,520</td>
                            <td style={{ padding: "16px", color: tokens.colors.green, fontFamily: "monospace", fontWeight: 900, fontSize: 16 }}>$37.00 – $92.00</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Cloud Unit Economics Grid */}
            <div style={{ ...cardStyle, padding: "32px" }}>
                <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={20} color={tokens.colors.purple} />
                    SaaS Cloud Unit Economics (At Scale of 10,000 Connected EVs)
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                    {saasStats.map((stat, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "20px",
                                borderRadius: 12,
                                background: stat.highlight ? "rgba(16, 185, 129, 0.08)" : "rgba(255,255,255,0.02)",
                                border: stat.highlight ? `1px solid ${tokens.colors.green}55` : "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            <div style={{ color: tokens.colors.textMuted, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6 }}>
                                {stat.label}
                            </div>
                            <div style={{ color: stat.highlight ? tokens.colors.green : "#fff", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
                                {stat.val}
                            </div>
                            <div style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
                                {stat.note}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
