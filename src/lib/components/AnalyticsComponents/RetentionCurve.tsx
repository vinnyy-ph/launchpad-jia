"use client";

import React from "react";
import { BarChart, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer, ReferenceLine } from "recharts";

interface RetentionCurveProps {
  data: any;
  customTooltipContent: any;
  title?: string;
  subtitle?: string;
  customGroupTickFormatter?: (value: string, index: number) => string;
  customGroupPercentageTickFormatter?: (value: number, index: number) => string;
}

export default function RetentionCurve({
  data,
  customTooltipContent,
  customGroupPercentageTickFormatter = (value: number, index: number) => [0, 2, 4, 7].includes(index) ? value + "%" : "",
  customGroupTickFormatter = (value: string, index: number) => [0, 2, 4, 7].includes(index) ? value : ""
}: RetentionCurveProps) {

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={174}>
      <BarChart
    accessibilityLayer
    barCategoryGap="0"
    barGap={0}
    data={data}
    margin={{
      bottom: 0,
      left: -30,
      right: 0,
      top: 0
    }}
    syncMethod="index"
  >
  <XAxis 
    xAxisId="a" 
    orientation="top"
    label={{ value: '', angle: 0, position: "top" }} 
    dataKey="groupPercentage"
    tickLine={false}
    axisLine={false}
    tickFormatter={customGroupPercentageTickFormatter}
    tick={{fontSize: 24, fontWeight: 700, color: "#181D27" }}
  />
  <XAxis 
    xAxisId="b" 
    orientation="top"
    type="category"
    label={{ value: '', angle: 0, position: 'top' }} 
    dataKey="group" 
    tickLine={false}
    axisLine={false}
    tickFormatter={customGroupTickFormatter}
    tick={{fontSize: 14, fontWeight: 500, color: "#717680" }}
  />
  <XAxis 
    height={0}
    xAxisId="c" 
    orientation="bottom"
    type="category"
    label={{ value: '', angle: 0, position: 'bottom' }} 
    dataKey="name" 
    tickLine={false}
    axisLine={false}
    tick={{ display: 'none' }}
  />
  <YAxis 
    yAxisId="a"
    tickLine={false}
    tick={{ display: "none" }}
    axisLine={{stroke: "#E9EAEB"}} 
    />
    <Tooltip 
    content={customTooltipContent}
    cursor={{ fill: "#F5F5F5" }}
    />
    <Bar
      dataKey="value"
    />
    <ReferenceLine xAxisId="c" stroke="#E9EAEB" x="AI Interview: Waiting Interview" position="start" ifOverflow="extendDomain" />
    <ReferenceLine xAxisId="c" stroke="#E9EAEB" x="Human Interview: Waiting Schedule" position="start" ifOverflow="extendDomain" />
    <ReferenceLine xAxisId="c" stroke="#E9EAEB" x="Job Offer: For Final Review" position="start" ifOverflow="extendDomain" />
  </BarChart>
  </ResponsiveContainer>
  );
}
