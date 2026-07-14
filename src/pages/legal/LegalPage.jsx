import { Link } from 'react-router-dom'
import Footer from '../../components/Footer'

/**
 * Shared shell for the static legal pages (/privacy, /terms). Public — a policy
 * you have to sign in to read is not a policy. Typography is applied to the
 * children from here so the documents themselves stay as close to plain prose as
 * possible and are easy to edit without touching classNames.
 */
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-sand">

      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center sticky top-0 z-10">
        <Link to="/" className="font-display font-extrabold text-[26px] text-brand tracking-[.07em] no-underline">POOLD</Link>
      </div>

      <div className="max-w-[640px] mx-auto px-[18px] pt-[26px]">

        <h1 className="font-display font-extrabold text-[38px] text-[#1C1610] leading-none mb-1.5">{title}</h1>
        <p className="text-[12px] text-warm-400 mt-0 mb-6">Last updated {updated}</p>

        <div
          className="
            text-[14px] text-warm-600 leading-[1.65]
            [&_h2]:font-display [&_h2]:font-extrabold [&_h2]:text-[19px] [&_h2]:text-[#1C1610]
            [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:leading-tight
            [&_p]:my-3
            [&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc
            [&_li]:my-1.5 [&_li]:pl-1
            [&_strong]:font-semibold [&_strong]:text-[#1C1610]
            [&_a]:text-brand [&_a]:font-medium
          "
        >
          {children}
        </div>

        <Footer />
      </div>

    </div>
  )
}
