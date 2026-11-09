export const tokens = {
    colors: {
        bg: "#030712",
        cyan: "#00f2fe",
        blue: "#4facfe",
        purple: "#a855f7",
        green: "#10b981",
        red: "#f87171",
        amber: "#f59e0b",
        textPrimary: "#ffffff",
        textSecondary: "#94a3b8",
        textMuted: "#475569",
        border: "rgba(255,255,255,0.08)",
        borderLight: "rgba(0,0,0,0.08)",
        cardBg: "rgba(255,255,255,0.03)",
        cardStrong: "rgba(255,255,255,0.06)",
    },
    animations: {
        float: {
            initial: { y: 0 },
            animate: { y: -8 },
            transition: { duration: 2.4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
        }
    }
} as const;

export const glass = {
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
} as const;

export const cardStyle = {
    ...glass,
    background: tokens.colors.cardBg,
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: 16,
} as const;

export const gradientText = {
    background: `linear-gradient(135deg, ${tokens.colors.cyan}, ${tokens.colors.blue}, ${tokens.colors.purple})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
} as const;
