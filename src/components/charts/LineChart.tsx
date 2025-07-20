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