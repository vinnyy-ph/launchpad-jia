"use client";

import React from "react";
import Container from "../../../../Container";
import SkeletonBox, { SkeletonWrapper } from "../SkeletonBox";

/**
 * Skeleton for EvaluationByJia section
 */
function EvaluationByJiaSkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonBox width={130} height={20} borderRadius={4} />
            <SkeletonBox width={90} height={24} borderRadius={12} />
          </div>
          <SkeletonBox width={100} height={32} borderRadius={60} />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Strong Points */}
        <div>
          <SkeletonBox width={100} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
            <SkeletonBox width="90%" height={14} borderRadius={4} />
            <SkeletonBox width="85%" height={14} borderRadius={4} />
            <SkeletonBox width="75%" height={14} borderRadius={4} />
          </div>
        </div>

        {/* Weak Points */}
        <div>
          <SkeletonBox width={90} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
            <SkeletonBox width="80%" height={14} borderRadius={4} />
            <SkeletonBox width="70%" height={14} borderRadius={4} />
          </div>
        </div>
      </div>
    </Container>
  );
}

/**
 * Skeleton for EvaluationByEndorser section
 */
function EvaluationByEndorserSkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SkeletonBox width={180} height={20} borderRadius={4} />
          <SkeletonBox width={80} height={24} borderRadius={12} />
        </div>
      }
      parentBgColor="#FFFCF5"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBox width="100%" height={16} borderRadius={4} />
        <SkeletonBox width="85%" height={16} borderRadius={4} />
        <SkeletonBox width="70%" height={16} borderRadius={4} />
      </div>
    </Container>
  );
}

/**
 * Skeleton for CandidateCV section
 */
function CandidateCVSkeleton() {
  return (
    <Container
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonBox width={110} height={20} borderRadius={4} />
            <SkeletonBox width={140} height={16} borderRadius={4} />
          </div>
          <SkeletonBox width={100} height={32} borderRadius={60} />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Experience */}
        <div>
          <SkeletonBox width={90} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="100%" height={14} borderRadius={4} />
            <SkeletonBox width="95%" height={14} borderRadius={4} />
            <SkeletonBox width="85%" height={14} borderRadius={4} />
            <SkeletonBox width="90%" height={14} borderRadius={4} />
          </div>
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Education */}
        <div>
          <SkeletonBox width={80} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="90%" height={14} borderRadius={4} />
            <SkeletonBox width="75%" height={14} borderRadius={4} />
          </div>
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Certifications */}
        <div>
          <SkeletonBox width={100} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="70%" height={14} borderRadius={4} />
            <SkeletonBox width="60%" height={14} borderRadius={4} />
          </div>
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Projects */}
        <div>
          <SkeletonBox width={70} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="95%" height={14} borderRadius={4} />
            <SkeletonBox width="80%" height={14} borderRadius={4} />
          </div>
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Awards */}
        <div>
          <SkeletonBox width={60} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="65%" height={14} borderRadius={4} />
          </div>
        </div>
      </div>
    </Container>
  );
}

/**
 * Skeleton for ContactInfo section
 */
function ContactInfoSkeleton() {
  return (
    <Container
      title={<SkeletonBox width={150} height={20} borderRadius={4} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Contact fields */}
        {["Email", "Phone", "Address", "LinkedIn", "GitHub", "Portfolio"].map((_, idx) => (
          <div key={idx}>
            <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonBox width={idx % 2 === 0 ? "70%" : "55%"} height={16} borderRadius={4} />
          </div>
        ))}
      </div>
    </Container>
  );
}

/**
 * Skeleton for PreScreeningQA section
 */
function PreScreeningQASkeleton() {
  return (
    <Container
      title={<SkeletonBox width={220} height={20} borderRadius={4} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3, 4].map((idx) => (
          <React.Fragment key={idx}>
            {idx > 1 && <div style={{ height: 1, background: "#EAECF0" }} />}
            <div>
              <SkeletonBox width={80} height={14} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonBox width="85%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <SkeletonBox width={50} height={14} borderRadius={4} />
                <SkeletonBox width={100} height={16} borderRadius={4} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Container>
  );
}

/**
 * Skeleton for Skills section
 */
function SkillsSkeleton() {
  return (
    <Container
      title={<SkeletonBox width={50} height={20} borderRadius={4} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Skill tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[70, 90, 55, 80, 65, 100, 45, 75, 85, 60, 95, 50].map((width, idx) => (
            <SkeletonBox key={idx} width={width} height={28} borderRadius={16} />
          ))}
        </div>
        {/* Footer text */}
        <SkeletonBox width={300} height={14} borderRadius={4} />
      </div>
    </Container>
  );
}

/**
 * Full CVScreening skeleton that mirrors the complete component structure.
 * Includes all sub-components: EvaluationByJia, EvaluationByEndorser, 
 * CandidateCV, ContactInfo, PreScreeningQA, and Skills.
 */
export default function CVScreeningSkeleton() {
  return (
    <SkeletonWrapper>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EvaluationByJiaSkeleton />
        <EvaluationByEndorserSkeleton />
        
        {/* Two-column layout like the real component */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 7 }}>
            <CandidateCVSkeleton />
          </div>
          <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 16 }}>
            <ContactInfoSkeleton />
            <PreScreeningQASkeleton />
            <SkillsSkeleton />
          </div>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

// Export individual skeletons for flexible use
export {
  EvaluationByJiaSkeleton,
  EvaluationByEndorserSkeleton,
  CandidateCVSkeleton,
  ContactInfoSkeleton,
  PreScreeningQASkeleton,
  SkillsSkeleton,
};
