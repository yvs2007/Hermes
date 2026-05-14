interface SectionRuleProps {
  /** "double" prints the broadsheet 4px double rule; "single" a hairline. */
  variant?: "double" | "single";
  className?: string;
}

export function SectionRule({ variant = "single", className }: SectionRuleProps) {
  if (variant === "double") {
    return <hr className={`my-4 border-0 border-t-rule border-double border-rule ${className ?? ""}`} />;
  }
  return <hr className={`my-3 border-0 border-t border-rule ${className ?? ""}`} />;
}
