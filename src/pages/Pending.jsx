export default function Pending() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-5xl text-fairway tracking-tight">PICK'EM</h1>
        </div>

        <div className="bg-white border border-warm-200 rounded-lg p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-gold text-xl leading-none">⏳</span>
          </div>
          <h2 className="font-display font-bold text-xl text-charcoal tracking-tight mb-2">
            Account Pending Approval
          </h2>
          <p className="text-sm text-warm-400 leading-relaxed">
            Your account is awaiting admin approval. You'll receive an email once you've been approved.
          </p>
        </div>
      </div>
    </div>
  )
}
