interface SkillActionModalProps {
    selectedSkill: string;
    skillEndorsements: any[];
    hasCurrentUserEndorsed: boolean;
    onClose: () => void;
    onRemoveClick: () => void;
    onEndorse: () => void;
    isEndorsing?: boolean;
}

export function SkillActionModal({ selectedSkill, skillEndorsements, hasCurrentUserEndorsed, onClose, onRemoveClick, onEndorse, isEndorsing = false, addedBy = "candidate" }: SkillActionModalProps & { addedBy?: "candidate" | "employer" }) {
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
            zIndex: 1001
        }}>
            <div
                className="fade-in-bottom"
                style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '24px',
                width: '90%',
                maxWidth: '500px',
                minWidth: '400px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#181D27', marginBottom: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSkill}</h2>
                        <span style={{ fontSize: '14px', color: '#717680' }}>
                            {addedBy === "employer" ? "Added by employer" : "Added by candidate"}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                            onClick={onRemoveClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 12px',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: '#ffffffff',
                                color: '#535862',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                        >
                            <i className="la la-trash" style={{ fontSize: '16px' }}></i>
                            <span>Remove Skill</span>
                        </button>
                        <button 
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#717680',
                                padding: '4px',
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
                
                {skillEndorsements.length > 0 ? (
                    <div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '16px',
                            paddingTop: '12px',
                            marginBottom: '16px',
                            borderTop: '1px solid #E5E7EB'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="la la-thumbs-up" style={{ fontSize: '20px', color: '#155EEF' }}></i>
                                <span style={{ fontSize: '14px', color: '#414651', fontWeight: 500 }}>
                                    {skillEndorsements.length} {skillEndorsements.length === 1 ? 'Endorsement' : 'Endorsements'}
                                </span>
                            </div>
                            <button 
                                disabled={hasCurrentUserEndorsed || isEndorsing}
                                onClick={onEndorse}
                                style={{
                                    padding: '8px 18px',
                                    border: hasCurrentUserEndorsed || isEndorsing ? '1px solid #EAECF0' : '1px solid #D0D5DD',
                                    borderRadius: '999px',
                                    backgroundColor: hasCurrentUserEndorsed || isEndorsing ? '#F9FAFB' : 'white',
                                    color: hasCurrentUserEndorsed || isEndorsing ? '#98A2B3' : '#181D27',
                                    cursor: hasCurrentUserEndorsed || isEndorsing ? 'default' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    outline: 'none',
                                    boxShadow: 'none',
                                }}
                            >
                                {isEndorsing ? (
                                    <>
                                        <i className="la la-spinner la-spin" style={{ fontSize: '16px' }}></i>
                                        <span>Endorsing...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="la la-thumbs-up" style={{ fontSize: '16px' }}></i>
                                        <span>{hasCurrentUserEndorsed ? 'Endorsed' : 'Endorse'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {skillEndorsements.map((endorsement, index) => {
                                let isCurrentUser = false;
                                let currentUserEmail: string | undefined;
                                let currentUserName: string | undefined;

                                if (typeof window !== 'undefined' && window.localStorage?.user) {
                                    try {
                                        const currentUser = JSON.parse(window.localStorage.user);
                                        currentUserEmail = currentUser?.email;
                                        currentUserName = currentUser?.name;
                                    } catch (e) {}
                                }

                                if (endorsement.endorserEmail && currentUserEmail && endorsement.endorserEmail === currentUserEmail) {
                                    isCurrentUser = true;
                                } else if (!endorsement.endorserEmail && currentUserName && currentUserName === endorsement.endorserName) {
                                    // Fallback for older records without endorserEmail
                                    isCurrentUser = true;
                                }

                                const displayName = isCurrentUser 
                                    ? `${endorsement.endorserName} (You)` 
                                    : endorsement.endorserName;

                                return (
                                    <div key={endorsement.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '12px 0',
                                        borderBottom: index < skillEndorsements.length - 1 ? '1px solid #f0f0f0' : 'none'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: '#e9ecef',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                color: '#6c757d',
                                                overflow: 'hidden'
                                            }}>
                                                {endorsement.endorserAvatar ? (
                                                    <img 
                                                        src={endorsement.endorserAvatar} 
                                                        alt={endorsement.endorserName}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            if (e.currentTarget.parentElement) {
                                                                e.currentTarget.parentElement.innerHTML = endorsement.endorserName.charAt(0).toUpperCase();
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    endorsement.endorserName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#181D27' }}>
                                                    {displayName}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                                    {endorsement.endorserRole}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                                            Endorsed on {endorsement.endorsedDate}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px solid #E5E7EB'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="la la-thumbs-up" style={{ fontSize: '20px', color: '#155EEF' }}></i>
                            <span style={{ fontSize: '14px', color: '#414651', fontWeight: 500 }}>No Endorsements yet</span>
                        </div>
                        <button 
                            disabled={hasCurrentUserEndorsed}
                            onClick={onEndorse}
                            style={{
                                padding: '8px 18px',
                                border: hasCurrentUserEndorsed ? '1px solid #EAECF0' : '1px solid #D0D5DD',
                                borderRadius: '999px',
                                backgroundColor: hasCurrentUserEndorsed ? '#F9FAFB' : 'white',
                                color: hasCurrentUserEndorsed ? '#98A2B3' : '#181D27',
                                cursor: hasCurrentUserEndorsed ? 'default' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                        >
                            <i className="la la-thumbs-up" style={{ fontSize: '16px' }}></i>
                            <span>{hasCurrentUserEndorsed ? 'Endorsed' : 'Endorse'}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}