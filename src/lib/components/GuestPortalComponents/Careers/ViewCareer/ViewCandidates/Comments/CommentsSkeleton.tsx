"use client";

import React from "react";
import Container from "../../../../Container";
import SkeletonBox, { SkeletonWrapper } from "../SkeletonBox";

/**
 * Skeleton for CommentInputField
 */
function CommentInputSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      {/* Avatar */}
      <SkeletonBox width={40} height={40} borderRadius={999} style={{ flexShrink: 0 }} />
      
      {/* Input area */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            border: "1px solid #D0D5DD",
            borderRadius: 8,
            padding: "12px 14px",
            background: "white",
            boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
          }}
        >
          {/* Textarea placeholder */}
          <SkeletonBox width="100%" height={150} borderRadius={4} />
          
          {/* Submit button area */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <SkeletonBox width={80} height={36} borderRadius={9999} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a single comment item
 */
function CommentItemSkeleton({ hasReplies = false }: { hasReplies?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Main comment */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Avatar */}
        <SkeletonBox width={40} height={40} borderRadius={999} style={{ flexShrink: 0 }} />
        
        {/* Comment content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Header: name, role, timestamp */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonBox width={100} height={16} borderRadius={4} />
            <SkeletonBox width={60} height={14} borderRadius={4} />
            <SkeletonBox width={50} height={14} borderRadius={4} />
          </div>
          
          {/* Comment text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonBox width="95%" height={14} borderRadius={4} />
            <SkeletonBox width="80%" height={14} borderRadius={4} />
            <SkeletonBox width="60%" height={14} borderRadius={4} />
          </div>
        </div>
      </div>

      {/* Reply - indented */}
      {hasReplies && (
        <div style={{ marginLeft: 40, display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Reply arrow icon placeholder */}
          <SkeletonBox width={12} height={12} borderRadius={2} style={{ marginTop: 8 }} />
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            {/* Reply item */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <SkeletonBox width={32} height={32} borderRadius={999} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SkeletonBox width={80} height={14} borderRadius={4} />
                  <SkeletonBox width={50} height={12} borderRadius={4} />
                </div>
                <SkeletonBox width="85%" height={14} borderRadius={4} />
                <SkeletonBox width="55%" height={14} borderRadius={4} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full Comments skeleton that mirrors the complete component structure.
 */
export default function CommentsSkeleton() {
  return (
    <SkeletonWrapper>
      <Container
        title={<SkeletonBox width={90} height={20} borderRadius={4} />}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Comment input field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CommentInputSkeleton />
            <div style={{ height: 1, background: "#EAECF0" }} />
          </div>

          {/* All Comments section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SkeletonBox width={110} height={18} borderRadius={4} />
            
            {/* Comment list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <CommentItemSkeleton hasReplies={true} />
              <CommentItemSkeleton hasReplies={false} />
              <CommentItemSkeleton hasReplies={true} />
            </div>
          </div>
        </div>
      </Container>
    </SkeletonWrapper>
  );
}
