export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-16"> {/* Add padding-top equal to navbar height */}
      {children}
    </div>
  );
} 