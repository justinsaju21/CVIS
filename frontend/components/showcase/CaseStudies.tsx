"use client";
import React from "react";
import { motion } from "framer-motion";
import { Car, Cloud, Server, Battery, Sparkles, ExternalLink } from "lucide-react";
import { tokens, cardStyle } from "./Styles";
import SectionHeading from "./SectionHeading";

export default function CaseStudies() {
    const studies = [
        {
            company: "Tesla Inc.",
            program: "Fleet Learning, Shadow Mode & Project Dojo",
            badge: "FLEET TRAINING",
            badgeColor: "#ef4444",
            desc: "Tesla on-vehicle Autopilot computers execute only basic forward-pass vision perception. High-entropy corner cases and disengagements stream back to centralized Dojo and H100 GPU clusters where models are continuously trained on billions of real-world fleet miles.",
            takeaway: "Validates the CVIS thesis that intelligence and heavy training belong in cloud supercomputers, not on vehicle edge silicon.",
        },
        {
            company: "Rivian Automotive",
            program: "AWS FleetOS & Custom Telematics Gateway Unit (TGU)",
            badge: "CLOUD CLUSTERING",
            badgeColor: "#0284c7",
            desc: "Rivian engineers custom Telematics Gateway Units (TGUs) streaming over MQTT and WebSockets to AWS FleetOS. Heavy battery degradation models, suspension damping optimization, and predictive thermal planning reside completely in cloud microservices.",
            takeaway: "Demonstrates production usage of thin-client automotive TGUs communicating with centralized AWS data centers.",
        },
        {
            company: "NIO Inc.",
            program: "Battery-as-a-Service (BaaS) & Cloud Cell Telematics",
            badge: "PREDICTIVE BATTERY",
            badgeColor: "#10b981",
            desc: "NIO monitors over 40 million battery cell telemetry data points per second in the NIO Cloud. Cloud algorithms track internal dendrite growth and impedance shifts, scheduling pack rebalancing across 2,000+ automated battery-swap stations before drivers experience degradation.",
            takeaway: "Proves that cross-fleet cell degradation analytics require centralized data warehousing rather than isolated in-car heuristics.",
        },
    ];

    return (
        <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto", borderTop: `1px solid ${tokens.colors.border}` }}>
            <SectionHeading
                pill="Industrial Proof-of-Concept"
                title="Real-World Automotive"
                gradientText="Case Studies"
                subtitle="How leading EV manufacturers deploy centralized cloud intelligence in production vehicles."
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                {studies.map((item, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -4 }}
                        style={{
                            ...cardStyle,
                            padding: "32px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            background: "rgba(255, 255, 255, 0.02)",
                        }}
                    >
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <span style={{
                                    fontSize: 11,
                                    fontFamily: "monospace",
                                    color: item.badgeColor,
                                    padding: "3px 10px",
                                    borderRadius: 6,
                                    background: `${item.badgeColor}15`,
                                    fontWeight: 700,
                                }}>
                                    {item.badge}
                                </span>
                                <Car size={18} color={item.badgeColor} />
                            </div>

                            <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{item.company}</h3>
                            <div style={{ color: tokens.colors.cyan, fontSize: 13, fontFamily: "monospace", marginBottom: 16 }}>{item.program}</div>
                            <p style={{ color: tokens.colors.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                                {item.desc}
                            </p>
                        </div>

                        <div style={{
                            padding: "14px",
                            background: "rgba(255, 255, 255, 0.03)",
                            borderRadius: 10,
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            color: tokens.colors.cyan,
                            fontSize: 12,
                            fontWeight: 600,
                        }}>
                            💡 <strong>Takeaway:</strong> {item.takeaway}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
