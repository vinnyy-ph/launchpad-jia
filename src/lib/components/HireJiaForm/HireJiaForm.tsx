import Script from "next/script";

export default function HireJiaForm() {
    return (
        <>
        <iframe
        src="https://link.hirejia.ai/widget/form/cMMSH3J7ADYiPN1zPUM4"
        style={{ display: "none", width: "100%", height: "100%", border: "none", borderRadius: "3px" }}
        id="popup-cMMSH3J7ADYiPN1zPUM4" 
        data-layout="{'id':'INLINE'}"
        data-trigger-type="alwaysShow"
        data-trigger-value=""
        data-activation-type="alwaysActivated"
        data-activation-value=""
        data-deactivation-type="leadCollected"
        data-deactivation-value=""
        data-form-name="Qualifying"
        data-height="1372"
        data-layout-iframe-id="popup-cMMSH3J7ADYiPN1zPUM4"
        data-form-id="cMMSH3J7ADYiPN1zPUM4"
        title="Qualifying"
        >
        </iframe>
        <Script src="https://link.hirejia.ai/js/form_embed.js" strategy="afterInteractive"></Script>
        </>
    )
}