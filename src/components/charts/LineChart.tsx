'use client';

import { ResponsiveLine } from '@nivo/line';

interface LineChartProps {
  data: Array<{
    id: string;
    data: Array<{
      x: string | number;
      y: number;
    }>;
  }>;
  height?: number;
}

export function LineChart({ data, height = 400 }: LineChartProps) {
  // Check if data is empty or has no valid data points
  const hasValidData = data && data.length > 0 && data.some(series => 
    series.data && series.data.length > 0 && series.data.some(point => point.y > 0)
  );

  if (!hasValidData) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm">Chart will display when data is available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveLine
        data={data}
        margin={{ top: 50, right: 110, bottom: 80, left: 80 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 8,
          tickRotation: -45,
          legend: 'Date',
          legendOffset: 60,
          legendPosition: 'middle'
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 8,
          tickRotation: 0,
          legend: 'Revenue (ETB)',
          legendOffset: -60,
          legendPosition: 'middle',
          format: (value) => `${value.toLocaleString()}`
        }}
        pointSize={8}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointLabelYOffset={-12}
        useMesh={true}
        legends={[
          {
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 100,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            symbolSize: 12,
            symbolShape: 'circle',
          }
        ]}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: '#6B7280',
                fontSize: 11
              }
            },
            legend: {
              text: {
                fill: '#374151',
                fontSize: 12,
                fontWeight: 600
              }
            }
          },
          grid: {
            line: {
              stroke: '#E5E7EB',
              strokeWidth: 1
            }
          },
          legends: {
            text: {
              fill: '#4B5563',
              fontSize: 11
            }
          }
        }}
      />
    </div>
  );
} 