'use client';

import { ResponsivePie } from '@nivo/pie';

interface PieChartProps {
  data: Array<{
    id: string;
    label: string;
    value: number;
  }>;
  height?: number;
}

export function PieChart({ data, height = 400 }: PieChartProps) {
  return (
    <div style={{ height }}>
      <ResponsivePie
        data={data}
        margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
        innerRadius={0.5}
        padAngle={0.7}
        cornerRadius={3}
        activeOuterRadiusOffset={8}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsTextColor="#374151"
        arcLinkLabelsThickness={2}
        arcLinkLabelsColor={{ from: 'color' }}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
        legends={[
          {
            anchor: 'bottom',
            direction: 'row',
            justify: false,
            translateX: 0,
            translateY: 56,
            itemsSpacing: 0,
            itemWidth: 100,
            itemHeight: 18,
            itemTextColor: '#6B7280',
            itemDirection: 'left-to-right',
            itemOpacity: 1,
            symbolSize: 18,
            symbolShape: 'circle',
          }
        ]}
        theme={{
          legends: {
            text: {
              fill: '#6B7280',
              fontSize: 11
            }
          }
        }}
      />
    </div>
  );
} 