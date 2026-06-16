export default function Pending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-3">⏳</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Pending Approval</h2>
        <p className="text-sm text-gray-500">
          Your account is awaiting admin approval. You'll receive an email once you've been approved.
        </p>
      </div>
    </div>
  )
}
