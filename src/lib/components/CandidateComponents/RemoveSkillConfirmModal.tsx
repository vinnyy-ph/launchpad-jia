interface RemoveSkillConfirmModalProps {
    onCancel: () => void;
    onConfirm: () => void;
    isRemoving?: boolean;
}

export function RemoveSkillConfirmModal({ onCancel, onConfirm, isRemoving = false }: RemoveSkillConfirmModalProps) {
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
            zIndex: 1002
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
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto'
                }}>
                    <i className="la la-trash" style={{ fontSize: '32px', color: '#dc2626' }}></i>
                </div>

                <h2 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#181D27' 
                }}>
                    Remove Skill
                </h2>

                <p style={{ 
                    margin: '0 0 32px 0', 
                    fontSize: '16px', 
                    color: '#6b7280',
                    lineHeight: '1.5'
                }}>
                    Are you sure you want to remove this skill?<br />
                    All endorsements will be removed.
                </p>

                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button 
                        onClick={onCancel}
                        disabled={isRemoving}
                        style={{
                            flex: 1,
                            padding: '12px 24px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '32px',
                            backgroundColor: 'white',
                            color: '#374151',
                            cursor: isRemoving ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            fontWeight: '500',
                            minWidth: '100px',
                            outline: 'none',
                            boxShadow: 'none',
                            opacity: isRemoving ? 0.7 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        disabled={isRemoving}
                        style={{
                            flex: 1,
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '32px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            cursor: isRemoving ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            fontWeight: '500',
                            minWidth: '100px',
                            outline: 'none',
                            boxShadow: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        {isRemoving ? (
                            <>
                                <i className="la la-spinner la-spin"></i>
                                <span>Removing...</span>
                            </>
                        ) : (
                            "Remove"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}