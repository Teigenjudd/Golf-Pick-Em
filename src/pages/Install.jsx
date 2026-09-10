import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

// "Add to Home Screen" instructions (general register — same sand/brand-rust styling
// as Profile). Not automatable: iOS only exposes the install action inside Safari's
// Share sheet, Android inside Chrome's overflow menu, and neither browser lets a page
// trigger that UI itself — so this is a plain how-to rather than a button.

function StepCard({ icon, platform, browser, steps }) {
  return (
    <div className="bg-white border border-[#EAD8C4] rounded-2xl px-[18px] py-5 mb-5">
      <div className="flex items-center gap-[10px] mb-[14px]">
        <span className="text-[22px] leading-none">{icon}</span>
        <div>
          <div className="font-display font-bold text-[15px] text-[#1C1610] leading-none">{platform}</div>
          <div className="text-[11.5px] text-warm-400 mt-[3px]">{browser}</div>
        </div>
      </div>
      <ol className="m-0 pl-[22px] space-y-[10px]">
        {steps.map((step, i) => (
          <li key={i} className="text-[13.5px] text-[#1C1610] leading-[1.5]">{step}</li>
        ))}
      </ol>
    </div>
  )
}

export default function Install() {
  return (
    <div className="min-h-screen bg-sand pb-10 flex flex-col">

      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="font-display font-extrabold text-[26px] text-brand tracking-[.07em] no-underline">POOLD</Link>
      </div>

      <div className="max-w-[480px] mx-auto px-[18px] pt-[22px] w-full">
        <h1 className="font-display font-extrabold text-[26px] text-[#1C1610] mt-[10px] mb-[6px]">
          Add Poold to your phone
        </h1>
        <p className="text-[13.5px] text-warm-400 leading-[1.5] mb-[22px]">
          Poold isn't in the App Store or Play Store — instead, your phone's browser can
          add it straight to your home screen with its own icon, so it opens like any
          other app.
        </p>

        <StepCard
          icon="📱"
          platform="iPhone / iPad"
          browser="Safari"
          steps={[
            'Open getpoold.app in Safari — this only works from Safari, not Chrome or another browser.',
            <>Tap the <strong>Share</strong> icon (the square with an arrow pointing up) in the toolbar.</>,
            <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
            <>Tap <strong>Add</strong> in the top right.</>,
          ]}
        />

        <StepCard
          icon="🤖"
          platform="Android"
          browser="Chrome"
          steps={[
            'Open getpoold.app in Chrome.',
            <>Tap the <strong>⋮</strong> menu in the top right.</>,
            <>Tap <strong>Add to Home screen</strong> (some phones show <strong>Install app</strong> instead).</>,
            <>Tap <strong>Add</strong> or <strong>Install</strong> to confirm.</>,
          ]}
        />

        <p className="text-[12px] text-warm-400 leading-[1.5]">
          Once it's added, open Poold from the home screen icon instead of a browser tab —
          same app, same login, just without the address bar.
        </p>
      </div>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
