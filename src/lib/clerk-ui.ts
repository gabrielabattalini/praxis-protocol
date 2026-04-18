export const clerkAppearance = {
  variables: {
    colorPrimary: "#fb923c",
    colorBackground: "transparent",
    colorText: "#f4f4f5",
    colorTextSecondary: "#d4d4d8",
    colorInputBackground: "#111114",
    colorInputText: "#f4f4f5",
    colorNeutral: "#121214",
    borderRadius: "0px",
    fontFamily: "var(--font-inter)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    main: "gap-5",
    header: "hidden",
    footer: "hidden",
    dividerLine: "bg-zinc-800",
    dividerText:
      "font-mono text-[0.58rem] uppercase tracking-[0.25em] text-zinc-600",
    formFieldLabel:
      "font-mono text-[0.58rem] uppercase tracking-[0.24em] text-zinc-400 font-semibold",
    formFieldInput:
      "h-12 border border-zinc-800 bg-[#111114] text-zinc-100 shadow-none transition placeholder:text-zinc-600 focus:border-amber-400/45 focus:ring-amber-400/20",
    formFieldInputShowPasswordButton:
      "text-zinc-500 hover:text-amber-300",
    formButtonPrimary:
      "h-12 border border-amber-400 bg-amber-400 text-[#090909] font-mono font-semibold tracking-[0.22em] uppercase shadow-[0_0_18px_rgba(251,146,60,0.28)] transition hover:bg-[#ffb16c] hover:shadow-[0_0_24px_rgba(251,146,60,0.42)]",
    formFieldAction:
      "text-amber-300 hover:text-amber-200 transition-colors",
    formResendCodeLink:
      "text-amber-300 hover:text-amber-200 transition-colors",
    formFieldRow: "gap-4",
    identityPreviewText: "text-zinc-300",
    identityPreviewEditButton: "text-amber-300 hover:text-amber-200",
    alert:
      "border border-amber-400/22 bg-amber-400/10 text-amber-100",
    otpCodeFieldInput:
      "h-12 border border-zinc-800 bg-[#111114] text-zinc-100",
    formFieldSuccessText: "text-emerald-300",
    formFieldErrorText: "text-rose-300",
    socialButtonsBlockButton:
      "h-12 border border-zinc-800 bg-[#111114] text-zinc-100 transition hover:border-amber-400/28 hover:bg-amber-400/10",
    socialButtonsBlockButtonText:
      "font-sans font-semibold tracking-[0.04em] text-zinc-200",
    alternativeMethodsBlockButton:
      "h-12 border border-zinc-800 bg-[#111114] text-zinc-100 transition hover:border-amber-400/28 hover:bg-amber-400/10",
    formHeaderTitle: "hidden",
    formHeaderSubtitle: "hidden",
  },
} as const;
