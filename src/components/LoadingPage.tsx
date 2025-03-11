export default function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Loading...</h2>
      </div>
    </div>
  );
} 