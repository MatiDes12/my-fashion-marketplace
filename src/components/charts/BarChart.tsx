'use client';

import { ResponsiveBar } from '@nivo/bar';

interface BarChartProps {
  data: Array<{
    [key: string]: string | number;
  }>;
  keys: string[];
  indexBy: string;
  height?: number;
}

export function BarChart({ data, keys, indexBy, height = 400 }: BarChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy={indexBy}
        margin={{ top: 50, right: 130, bottom: 80, left: 80 }}
        padding={0.3}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={{ scheme: 'nivo' }}
        borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
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
          legend: 'Transactions',
          legendOffset: -60,
          legendPosition: 'middle',
          format: (value) => `${value.toLocaleString()}`
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 120,
            translateY: 0,
            itemsSpacing: 2,
            itemWidth: 100,
            itemHeight: 20,
            itemDirection: 'left-to-right',
            itemOpacity: 0.85,
            symbolSize: 20,
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