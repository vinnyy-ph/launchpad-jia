"use client";

import React from "react";
import Container from "../../../../Container";
import SkeletonBox, { SkeletonWrapper } from "../SkeletonBox";

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
 * Skeleton for InterviewAnalysis section
 */
function InterviewAnalysisSkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <SkeletonBox width={140} height={20} borderRadius={4} />
          <SkeletonBox width={100} height={32} borderRadius={60} />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Score and Assessment - just simple boxes, no big circle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonBox width={100} height={28} borderRadius={12} />
          <SkeletonBox width="90%" height={16} borderRadius={4} />
          <SkeletonBox width="75%" height={16} borderRadius={4} />
        </div>

        {/* Applicant Qualities Breakdown */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            borderRadius: 8,
            border: "1px solid #E9EAEB",
            padding: "16px 24px",
            background: "#FAFAFA",
          }}
        >
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <SkeletonBox width={100} height={16} borderRadius={4} />
              <SkeletonBox width="50%" height={8} borderRadius={4} style={{ marginLeft: 16, marginRight: 16 }} />
              <SkeletonBox width={40} height={16} borderRadius={4} />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

/**
 * Skeleton for InterviewSummary section
 */
function InterviewSummarySkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <SkeletonBox width={140} height={20} borderRadius={4} />
          <SkeletonBox width={100} height={32} borderRadius={60} />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonBox width="100%" height={16} borderRadius={4} />
        <SkeletonBox width="95%" height={16} borderRadius={4} />
        <SkeletonBox width="88%" height={16} borderRadius={4} />
        <SkeletonBox width="92%" height={16} borderRadius={4} />
        <SkeletonBox width="60%" height={16} borderRadius={4} />
      </div>
    </Container>
  );
}

/**
 * Skeleton for InterviewTranscript section
 */
function InterviewTranscriptSkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBox width={150} height={20} borderRadius={4} />
          <SkeletonBox width={100} height={28} borderRadius={60} />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Alternating message bubbles */}
        {[
          { isUser: false, width: "65%" },
          { isUser: true, width: "55%" },
          { isUser: false, width: "70%" },
          { isUser: true, width: "45%" },
          { isUser: false, width: "60%" },
          { isUser: true, width: "50%" },
        ].map((msg, idx) => (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Message Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SkeletonBox width={60} height={14} borderRadius={4} />
              <SkeletonBox width={50} height={12} borderRadius={4} />
              <div style={{ width: 1, height: 14, backgroundColor: "#E9EAEB" }} />
              <SkeletonBox width={30} height={12} borderRadius={4} />
            </div>
            {/* Message Bubble */}
            <SkeletonBox
              width={msg.width}
              height={48}
              borderRadius={8}
              style={{
                background: msg.isUser
                  ? "linear-gradient(90deg, #F8F9FC 0%, #EEF0F4 50%, #F8F9FC 100%)"
                  : "linear-gradient(90deg, #EFF8FF 0%, #D6EBFF 50%, #EFF8FF 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          </div>
        ))}
      </div>
    </Container>
  );
}

/**
 * Skeleton for VideoRecording section
 */
function VideoRecordingSkeleton() {
  return (
    <Container
      icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
      title={<SkeletonBox width={140} height={20} borderRadius={4} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Video player placeholder */}
        <SkeletonBox width="100%" height={280} borderRadius={8} />
        {/* Playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBox width={100} height={16} borderRadius={4} />
          <SkeletonBox width={80} height={32} borderRadius={6} />
        </div>
      </div>
    </Container>
  );
}

/**
 * Full AIInterview skeleton that mirrors the complete component structure.
 */
export default function AIInterviewSkeleton() {
  return (
    <SkeletonWrapper>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EvaluationByEndorserSkeleton />
        <InterviewAnalysisSkeleton />
        <InterviewSummarySkeleton />
        <InterviewTranscriptSkeleton />
        <VideoRecordingSkeleton />
      </div>
    </SkeletonWrapper>
  );
}
