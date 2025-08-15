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
  // Check if data is empty or has no valid data points
  const hasValidData = data && data.length > 0 && data.some(item => item.value > 0);

  if (!hasValidData) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm">Chart will display when data is available</p>
        </div>
      </div>
    );
  }

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