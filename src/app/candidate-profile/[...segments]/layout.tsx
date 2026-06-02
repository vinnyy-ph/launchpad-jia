import CandidateProfileProvider from "@/lib/components/CandidateProfileComponents/CandidateProfileProvider";

export default function CandidateProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Provides modal functionality (for password prompt) */}
      <CandidateProfileProvider> 
        {children}
      </CandidateProfileProvider>

      {/* Only navbar is unused for this layout, hence this should be enough */}
      <style>{`
        nav { display: none !important; }
        div[onclick] { display: none !important; }
        body { background-color: #F8F9FC; padding: 8px 24px 24px; }
      `}</style>
    </>
  );
}
