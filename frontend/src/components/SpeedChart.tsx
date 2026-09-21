import { AreaChart, type ChartProps } from '@fluentui/react-charts'
import { useEffect, useMemo, useState } from 'react'

const MAX_DATAPOINTS = 30
const MIN_SCALE_SPEED = 100 * 1024

interface SpeedChartProps {
  uploadSpeed: number
  downloadSpeed: number
}

interface SpeedPoint {
  up: number
  down: number
}

export function SpeedChart({ uploadSpeed, downloadSpeed }: SpeedChartProps) {
  const [history, setHistory] = useState<SpeedPoint[]>(() => Array.from({ length: MAX_DATAPOINTS }, () => ({ up: 0, down: 0 })))

  useEffect(() => {
    setHistory((current) => [...current.slice(-(MAX_DATAPOINTS - 1)), { up: uploadSpeed, down: downloadSpeed }])
  }, [downloadSpeed, uploadSpeed])

  const maxSpeed = useMemo(() => Math.max(MIN_SCALE_SPEED, ...history.flatMap((point) => [point.up, point.down])), [history])
  const chartData = useMemo<ChartProps>(() => ({
    lineChartData: [
      {
        legend: 'Download',
        color: '#3b82f6',
        opacity: 0.18,
        hideNonActiveDots: true,
        data: history.map((point, index) => ({ x: index, y: point.down })),
      },
      {
        legend: 'Upload',
        color: '#10b981',
        opacity: 0.18,
        hideNonActiveDots: true,
        data: history.map((point, index) => ({ x: index, y: point.up })),
      },
    ],
  }), [history])

  return (
    <div className="speed-chart" aria-label={`Network speed chart, maximum scale ${maxSpeed} bytes per second`}>
      <AreaChart
        data={chartData}
        height={100}
        width={300}
        yMinValue={0}
        yMaxValue={maxSpeed}
        yAxisTickCount={1}
        xAxisTickCount={1}
        tickValues={[]}
        yAxisTickValues={[]}
        margins={{ top: 2, right: 0, bottom: 2, left: 0 }}
        hideLegend
        hideTooltip
        enableGradient
        enablePerfOptimization
        optimizeLargeData
        svgProps={{ 'aria-hidden': true }}
      />
    </div>
  )
}
