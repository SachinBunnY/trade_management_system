import React, { JSX, useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  AreaSeriesPartialOptions,
  Time,
  UTCTimestamp,
  SingleValueData,LineStyle,
  IPriceLine,
} from "lightweight-charts";
import "./AreaChart.css";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import { fixedModelName } from "../services/util";

interface ExtendedValueData extends SingleValueData {
  customValues?: { return_perc: number };
}

type InputData = {
  [time: string]: {
    [modelId: string]: { n_pl: number; n_return_perc: number };
  };
};

interface Props {
  input: InputData;
}

export default function AreaChart({ input }: Props): JSX.Element {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const selectedID = useSelector((state: RootState) => state.trade.selectedClientId);
  const selectedModelName = useSelector((state:RootState)=>state.trade.selectedModelName);
  const minLineRef = useRef<IPriceLine | null>(null);
  const maxLineRef = useRef<IPriceLine | null>(null);
  const totalMarginAllocated:any = useSelector((state:RootState)=>state.trade.totalMarginAllocated)
  
  const parseTime = (timeStr: string): UTCTimestamp => {
    const clean = timeStr.split(".")[0]; 
    const [hh, mm, ss] = clean.split(":").map(Number);
    const base = new Date(Date.UTC(1970, 0, 1, hh, mm, ss)); 
    return Math.floor(base.getTime() / 1000) as UTCTimestamp;
  };

  const transformData = (raw: InputData): SingleValueData[] => {
    // console.log("raw::",raw);
    
    const result: SingleValueData[] = [];
    if (!raw) return result;
  
    Object.entries(raw).forEach(([time, models]) => {
      let value = 0;  
      Object.entries(models).forEach(([modelId, { n_pl }]) => {
        
        const prefix = modelId.split("_")[0]; // MS1, MS2, etc.
        const sufix = modelId.split("_")[1];
        // ---- Case 1: Both client + model ----
        // if (selectedID !== "All" && selectedModelName &&
        //   sufix.includes(selectedID) && prefix.startsWith(fixedModelName[selectedModelName])
        // ) {
        //   value += n_pl;
        // }
  
        // ---- Case 2: Client only ----
        if (selectedID !== "All" &&
          selectedModelName === "All" && sufix.includes(selectedID)
        ) {
          value += n_pl;
        }
  
        // // ---- Case 3: Model only ----
        // else if (
        //   selectedID === "All" && selectedModelName &&
        //   prefix.startsWith(fixedModelName[selectedModelName])
        // ) {
        //   value += n_pl;
        // }
  
        // ---- Case 4: All (no filter) ----
        // else if (selectedID === "All" && selectedModelName=== "All") {
          // value += n_pl;
        // }
        else{
          value += n_pl;
        }
      });      
      result.push({ time: parseTime(time), value ,customValues: { return_perc:(Number(value)/totalMarginAllocated)*100 }});
    });
  
    return result.sort((a, b) => (a.time as number) - (b.time as number));
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
  
    // ----- Create chart only once -----
    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          textColor: "#fff",
          background: { color: "#2e2e2e" },
        },
        rightPriceScale: {
          scaleMargins: { top: 0.3, bottom: 0.25 },
        },
        crosshair: {
          horzLine: { visible: false, labelVisible: false },
          vertLine: { labelVisible: false },
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
      chartRef.current = chart;
  
      const areaSeries = chart.addAreaSeries({
        lineWidth: 2,
        crossHairMarkerVisible: false,
      } as AreaSeriesPartialOptions);
      seriesRef.current = areaSeries;
  
      chart.timeScale().fitContent();
  
      // handle resize...
      const resize = () => {
        if (!chartContainerRef.current) return;
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          timeScale: {
            timeVisible: true,
            secondsVisible: true,
            tickMarkFormatter: (time: Time) => {
              const date = new Date((time as number) * 1000);
              return date.toISOString().substr(11, 8);
            },
          },
        });
      };
      const ro = new ResizeObserver(resize);
      ro.observe(chartContainerRef.current);
      window.addEventListener("resize", resize);
  
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", resize);
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    }
  }, []); 
  

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const series = seriesRef.current;
    const chart = chartRef.current;

    const data = transformData(input);
    if (data.length === 0) return;

    // ---- Set or update data ----
    if (!(series as any)._dataSetOnce) {
      series.setData(data);
      (series as any)._dataSetOnce = true;
    } else {
      series.update(data[data.length - 1]);
    }

    // ---- Calculate min/max ----
    const values = data.map(d => d.value);
    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);

    // ---- Create or update min line ----
    if (!minLineRef.current) {
      minLineRef.current = series.createPriceLine({
        price: minPrice,
        color: "#ef5350",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "min price",
      });
    } else {
      minLineRef.current.applyOptions({ price: minPrice });
    }

    // ---- Create or update max line ----
    if (!maxLineRef.current) {
      maxLineRef.current = series.createPriceLine({
        price: maxPrice,
        color: "#26a69a",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "max price",
      });
    } else {
      maxLineRef.current.applyOptions({ price: maxPrice });
    }

    // ---- Dynamic color ----
    const lastValue = data[data.length - 1].value;
    series.applyOptions(
      lastValue < 0
        ? {
            topColor: "rgba(244, 67, 54, 0.28)",
            bottomColor: "rgba(244, 67, 54, 0.05)",
            lineColor: "rgba(244, 67, 54, 1)",
          }
        : {
            topColor: "rgba(38, 166, 154, 0.28)",
            bottomColor: "rgba(38, 166, 154, 0.05)",
            lineColor: "rgba(38, 166, 154, 1)",
          }
    );
  
    // ----- Fit content -----
    chart.timeScale().fitContent();
  
    // ----- Tooltip -----
    const tooltip = document.createElement("div");
    tooltip.className = "floating-tooltip";
    Object.assign(tooltip.style, {
      position: "absolute",
      display: "none",
      background: "#fff",
      border: "1px solid rgba(117, 117, 117, 0.2)",
      padding: "10px",
      borderRadius: "4px",
      fontSize: "15px",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(tooltip);
  
    const crosshairHandler = (param: any) => {
      if (!param.point || !param.time) {
        tooltip.style.display = "none";
        return;
      }
  
      const price = param.seriesData.get(series) as any;
      if (price) {
        tooltip.style.display = "block";
  
        const bounds = chartContainerRef.current!.getBoundingClientRect();
        tooltip.style.left = bounds.left + param.point.x + 15 + "px";
        tooltip.style.top = bounds.top + param.point.y + 15 + "px";
  
        const date = new Date((param.time as number) * 1000);
        const valueColor = price.value < 0 ? "red" : "teal";
  
        tooltip.innerHTML = `
          <div><strong>Value: &nbsp;</strong> 
            <span style="color:${valueColor}">
              ${price.value.toFixed(2)}
            </span>
          </div>
          <div><strong>Return %: &nbsp;</strong> 
            <span style="color:${valueColor}">
              ${(price.customValues?.return_perc ?? 0).toFixed(2)}%
            </span>
          </div>
          <div><strong>Time: &nbsp;</strong> ${date.toISOString().substr(11, 8)}</div>
        `;
      }
    };
  
    chart.subscribeCrosshairMove(crosshairHandler);
  
    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
      if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    };
  }, [input, selectedID]);
  



  return (
    <div className="chart-container">
      <div ref={chartContainerRef} className="chart-div" />
    </div>
  );
}
