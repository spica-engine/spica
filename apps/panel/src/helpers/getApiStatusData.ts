import axios from "axios";

const TOKEN = localStorage.getItem("token") || "";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const GRAPH_SEGMENT_COUNT = 40;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: TOKEN,
    "Content-Type": "application/json"
  }
});

const createTimeSegments = (startTimestamp: number, endTimestamp: number, segmentCount: number) => {
  const totalDuration = endTimestamp - startTimestamp;
  const step = Math.floor(totalDuration / segmentCount);

  return Array.from({length: segmentCount}, (_, i) => {
    const beginTime = startTimestamp + i * step;
    const endTime = i === segmentCount - 1 ? endTimestamp : startTimestamp + (i + 1) * step;

    return {
      begin: new Date(beginTime),
      end: new Date(endTime)
    };
  });
};

const createApiRequest = async ({begin, end}: {begin: Date; end: Date}) => {
  try {
    const response = await apiClient.get(
      `api/status/api?begin=${begin.toISOString()}&end=${end.toISOString()}`
    );

    return {
      begin,
      end,
      data: response.data,
      success: true
    };
  } catch (error: any) {
    return {
      begin,
      end,
      error: error.response?.data?.message || error.message
    };
  }
};

export const getApiStatusData = async () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startTimestamp = startOfDay.getTime();
  const endTimestamp = now.getTime();

  const timeSegments = createTimeSegments(startTimestamp, endTimestamp, GRAPH_SEGMENT_COUNT);

  const requests = timeSegments.map(createApiRequest);

  const results = await Promise.allSettled(requests);

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        begin: timeSegments[index].begin,
        end: timeSegments[index].end,
        error: result.reason?.message || "Unknown error"
      };
    }
  });
};
