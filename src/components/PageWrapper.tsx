export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-[120px] bg-gradient-to-b from-gray-50 to-white">
      <div className="animate-fadeIn">
        {children}
      </div>
    </div>
  );
} 