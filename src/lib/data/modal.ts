export const troubleshootingGuideModalData = [
  {
    device: "desktop",
    title: "Safari (macOS)",
    description: `
    <ol>
      <li>Open Safari Settings.</li>
      <li>Go to the Websites tab.</li>
      <li>Select Pop-up Windows in the left sidebar.</li>
      <li>Find hellojia.ai (or the Jia login page).</li>
      <li>Set it to Allow.</li>
    </ol>
    `,
    image: "/troubleshoot/Safari (macOS).png",
  },
  {
    device: "desktop",
    title: "Google Chrome",
    description: `
    <ol>
      <li>Click the three dots (⋮) in the top-right corner of Chrome.</li>
      <li>Click Settings → Privacy and Security.</li>
      <li>Click Site Settings and scroll down to Pop-ups and redirects.</li>
      <li>Enable Sites can send pop-ups and use redirects.</li>
    </ol>
    `,
    image: "/troubleshoot/Chrome (Desktop).png",
  },
  {
    device: "desktop",
    title: "Mozilla Firefox",
    description: `
    <ol>
      <li>Click the ☰ menu in Firefox</li>
      <li>Go to Settings → Privacy & Security.</li>
      <li>Scroll to Permissions.</li>
      <li>Uncheck Block pop-ups and third-party redirects.</li>
    </ol>
    `,
    image: "/troubleshoot/Firefox.png",
  },
  {
    device: "desktop",
    title: "Microsoft Edge",
    description: `
    <ol>
      <li>Click the three dots (⋯) menu in Edge.</li>
      <li>Go to Settings → Privacy, search, and services.</li>
      <li>Scroll down and click Site permissions.</li>
      <li>Click Pop-ups and redirects.</li>
      <li>Turn OFF the toggle for Blocked (recommended) to allow pop-ups.</li>
    </ol>
    `,
    image: "/troubleshoot/Edge.png",
  },
  {
    device: "mobile",
    title: "Safari (iPhone / iPad)",
    description: `
    <ol>
      <li>Open Settings on your device.</li>
      <li>Scroll down and tap Safari.</li>
      <li>Turn Block Pop-ups off.</li>
      <li>Return to Jia and try signing in again.</li>
    </ol>
    <br />
    <span>A new tab should open after clicking 'Continue with Google'.</span>
    `,
    image: "/troubleshoot/Safari (iOS).png",
  },
  {
    device: "mobile",
    title: "Chrome",
    description: `
    <ol>
      <li>Open Chrome.</li>
      <li>Tap the three dots (⋯) → Settings.</li>
      <li>Scroll down and tap Content settings.</li>
      <li>Turn Block Pop-ups off.</li>
    </ol>
    `,
    image: "/troubleshoot/Chrome (Mobile).png",
  },
  {
    device: "mobile",
    title: "Samsung Internet",
    description: `
    <ol>
      <li>Open Samsung Internet.</li>
      <li>Tap the ☰ menu → Settings.</li>
      <li>Tap Sites and downloads.</li>
      <li>Turn Block pop-ups off.</li>
    </ol>
    `,
    image: "/troubleshoot/Samsung Internet.png",
  },
];
