import { AreaChart, type ChartProps } from '@fluentui/react-charts'
import { webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { useLayoutEffect, useMemo, useState } from 'react'
import type { SpeedPoint } from '../utils/trafficHistory'

const MIN_SCALE_SPEED = 100 * 1024
const noTicks: number[] = []
const margins = { top: 2, right: 0, bottom: 2, left: 0 }
const svgProps = { 'aria-hidden': true } as const

export function SpeedChart({ history, dark }: { history: SpeedPoint[]; dark: boolean }) {
  const palette = dark ? webDarkTheme : webLightTheme
  const [mount, setMount] = useState(0)
  // ponytail: react-charts 9.3.25 clears its imperative paths when Activity hides.
  // Remount only the renderer on reveal; history stays in AppContext.
  // Remove when the locked chart supports Activity effect reconnection.
  useLayoutEffect(() => { setMount(value => value + 1) }, [])
  const maxSpeed = useMemo(() => Math.max(MIN_SCALE_SPEED, ...history.flatMap((point) => [point.up, point.down])), [history])
  const chartData = useMemo<ChartProps>(() => ({
    lineChartData: [
      {
        legend: 'Download',
        color: palette.colorPaletteBlueForeground2,
        hideNonActiveDots: true,
        lineOptions: { curve: 'linear', strokeWidth: 1.5, strokeLinecap: 'round' },
        data: history.map((point, index) => ({ x: index, y: point.down })),
      },
      {
        legend: 'Upload',
        color: palette.colorPaletteGreenForeground1,
        hideNonActiveDots: true,
        lineOptions: { curve: 'linear', strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '4 2' },
        data: history.map((point, index) => ({ x: index, y: point.up })),
      },
    ],
  }), [history, palette])

  return (
    <div className="speed-chart" aria-label={`Network speed chart, maximum scale ${maxSpeed} bytes per second`}>
      <AreaChart
        key={mount}
        data={chartData}
        height={100}
        width={300}
        yMinValue={0}
        yMaxValue={maxSpeed}
        yAxisTickCount={1}
        xAxisTickCount={1}
        tickValues={noTicks}
        yAxisTickValues={noTicks}
        margins={margins}
        mode="tozeroy"
        hideLegend
        hideTooltip
        enableGradient
        enablePerfOptimization
        optimizeLargeData
        svgProps={svgProps}
      />
    </div>
  )
}
