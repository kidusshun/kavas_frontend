interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-8 w-auto" }: LogoProps) {
  return <img src="/logo.svg" className={className} alt="Logo" />;
}
