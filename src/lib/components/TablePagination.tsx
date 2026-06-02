export default function TablePagination({ currentPage, totalPages, setCurrentPage }: { currentPage: number, totalPages: number, setCurrentPage: (page: number) => void }) {
    return (
        <div className="d-flex justify-content-between align-items-center" style={{ padding: "15px 20px", width: "100%" }}>
            <button 
            className="btn btn-primary shadow-none" 
            disabled={currentPage === 1}
            style={{ backgroundColor: "white", border: "1px solid lightgray", cursor: currentPage === 1 ? "not-allowed" : "pointer", color: currentPage === 1 ? "#D5D7DA" : "black", fontSize: "14px", fontWeight: 550, borderRadius: "60px" }}
            onClick={() => {
            if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
            }
            }}>
            <i className="la la-arrow-left"></i> Previous
            </button>

            <div>
            {Array.from({ length: totalPages }, (_, index) => (
                <button 
                key={index} 
                className={`btn shadow-none ${currentPage === index + 1 ? "btn-primary" : ""}`} 
                style={{ backgroundColor: currentPage === index + 1 ? "#F8F8F8": "white", color: "black", border: "none", fontSize: "14px", fontWeight: 550, borderRadius: "60px" }}
                onClick={() => {
                setCurrentPage(index + 1);
                }}
                >
                {index + 1}
                </button>
            ))}
            </div>
        
            <button 
            className="btn btn-primary shadow-none" 
            disabled={currentPage >= totalPages}
            style={{ backgroundColor: "white", border: "1px solid lightgray", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", color: currentPage >= totalPages ? "#D5D7DA" : "black", fontSize: "14px", fontWeight: 550, borderRadius: "60px" }}
            onClick={() => {
            if (currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
            }
            }}>
            <i className="la la-arrow-right"></i> Next
            </button>
      </div>
    )
}