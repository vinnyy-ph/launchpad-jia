"use client";

import React from "react";
import Container from "../../../../Container";
import SkeletonBox, { SkeletonWrapper } from "../SkeletonBox";

/**
 * Skeleton for HumanInterview that mirrors the EvaluationByEndorser structure.
 */
export default function HumanInterviewSkeleton() {
  return (
    <SkeletonWrapper>
      <Container
        icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <SkeletonBox width={180} height={20} borderRadius={4} />
            <SkeletonBox width={80} height={24} borderRadius={12} />
          </div>
        }
        parentBgColor="#FFFCF5"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Evaluation notes placeholder */}
          <SkeletonBox width="100%" height={16} borderRadius={4} />
          <SkeletonBox width="92%" height={16} borderRadius={4} />
          <SkeletonBox width="85%" height={16} borderRadius={4} />
          <SkeletonBox width="78%" height={16} borderRadius={4} />
          <SkeletonBox width="65%" height={16} borderRadius={4} />
        </div>
      </Container>
    </SkeletonWrapper>
  );
}
