"use client";

import React from "react";
import Container from "../../../../Container";
import SkeletonBox, { SkeletonWrapper } from "../SkeletonBox";

/**
 * Skeleton for CustomStages that mirrors the EvaluationByEndorser structure.
 * Pure skeleton - no text display, just lazy loading boxes.
 */
export default function CustomStagesSkeleton() {
  return (
    <SkeletonWrapper>
      <Container
        icon={<SkeletonBox width={32} height={32} borderRadius={999} />}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <SkeletonBox width={160} height={20} borderRadius={4} />
            <SkeletonBox width={80} height={24} borderRadius={12} />
          </div>
        }
        parentBgColor="#FFFCF5"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonBox width="100%" height={16} borderRadius={4} />
          <SkeletonBox width="90%" height={16} borderRadius={4} />
          <SkeletonBox width="75%" height={16} borderRadius={4} />
          <SkeletonBox width="60%" height={16} borderRadius={4} />
        </div>
      </Container>
    </SkeletonWrapper>
  );
}
