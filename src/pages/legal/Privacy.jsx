import LegalPage from './LegalPage'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="July 14, 2026">

      <p>
        Poold (&ldquo;we,&rdquo; &ldquo;us&rdquo;) runs private pick&rsquo;em pools for people who already know each
        other. This policy explains what we collect, why, and what we do with it. It is
        short on purpose, because we collect very little.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your email address.</strong> It is how you sign in — we email you a sign-in link instead of using passwords. We never sell it, rent it, or use it to market anything to you.</li>
        <li><strong>Your display name.</strong> You choose it, and you can change it at any time from the You tab. This is the only thing other people in your pools see.</li>
        <li><strong>Your picks and scores.</strong> The players you select and the results that follow from them.</li>
        <li><strong>Basic technical logs.</strong> Our host keeps standard server logs (IP address, browser type, timestamps) for security and reliability. We do not use advertising trackers or third-party analytics.</li>
      </ul>

      <h2>Who can see what</h2>
      <p>
        <strong>Your email address is never shown to other players.</strong> Only you and a site
        administrator can see it. Your display name and your picks are visible to the other
        members of any pool you join — picks become visible to them once that pool locks,
        which is the whole point of a pool. Nothing you do here is visible to the public
        internet.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We do not sell your data and we do not share it with anyone for their own purposes.
        We rely on a small number of service providers to run the app:
      </p>
      <ul>
        <li><strong>Supabase</strong> — our database and sign-in system. Your email, display name, and picks are stored there.</li>
        <li><strong>Netlify</strong> — hosts the website itself.</li>
      </ul>
      <p>
        We also pull tournament fields, live scores, betting odds, and weather from
        third-party providers. Those requests carry <em>no information about you</em> — we ask
        them about golf, not about our users.
      </p>

      <h2>Keeping it, and deleting it</h2>
      <p>
        We keep your account for as long as you have one. If you want it gone, email{' '}
        <a href="mailto:privacy@getpoold.app">privacy@getpoold.app</a> and we will delete your
        profile, your picks, and your email address. Scores already recorded in a completed
        pool may remain visible to that pool&rsquo;s other members, with your entry anonymized.
      </p>

      <h2>Cookies</h2>
      <p>
        We store a sign-in token in your browser so you stay logged in between visits, and a
        note of whether you have dismissed certain prompts. That is all. There are no
        advertising or tracking cookies.
      </p>

      <h2>Children</h2>
      <p>
        Poold is not intended for anyone under 18, and we do not knowingly collect
        information from children.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will update the date at the top
        and, if the change is significant, tell you in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, or want your data deleted? Email{' '}
        <a href="mailto:privacy@getpoold.app">privacy@getpoold.app</a>.
      </p>

    </LegalPage>
  )
}
