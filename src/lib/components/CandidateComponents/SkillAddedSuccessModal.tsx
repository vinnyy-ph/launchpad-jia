interface SkillsAddedSuccessModalProps {
    onClose: () => void;
    onAddMore: () => void;
}

export function SkillsAddedSuccessModal({ onClose, onAddMore }: SkillsAddedSuccessModalProps) {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1003
        }}>
            <div
                className="fade-in-bottom"
                style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '32px',
                width: '90%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#9ca3af',
                            padding: '0',
                            outline: 'none',
                            boxShadow: 'none',
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#d1fae5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto'
                }}>
                    <i className="la la-check" style={{ fontSize: '32px', color: '#10b981' }}></i>
                </div>

                <h2 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#181D27' 
                }}>
                    Skills have been added
                </h2>

                <p style={{ 
                    margin: '0 0 32px 0', 
                    fontSize: '16px', 
                    color: '#6b7280',
                    lineHeight: '1.5'
                }}>
                    Chosen skills have been added to the candidate.
                </p>

                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '12px 24px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '32px',
                            backgroundColor: 'white',
                            color: '#374151',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '500',
                            minWidth: '120px',
                            outline: 'none',
                            boxShadow: 'none',
                        }}
                    >
                        No thanks
                    </button>
                    <button 
                        onClick={onAddMore}
                        style={{
                            flex: 1,
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '32px',
                            backgroundColor: '#181D27',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '500',
                            minWidth: '120px',
                            outline: 'none',
                            boxShadow: 'none',
                        }}
                    >
                        Add more skills
                    </button>
                </div>
            </div>
        </div>
    );
}
