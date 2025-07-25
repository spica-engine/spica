import {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../contexts/AuthContext";

export function useRequestTracker() {
  const navigate = useNavigate();
  const {logout} = useAuth();
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (
          entry.entryType === "resource" &&
          entry.initiatorType === "xmlhttprequest" &&
          entry.responseStatus === 401
        ) {
          logout();
          navigate("/passport/identify");
          observer.disconnect();
        }
      }
    });

    try {
      observer.observe({type: "resource"});
    } catch (err) {
      console.warn("PerformanceObserver not supported:", err);
    }

    return () => observer.disconnect();
  }, []);
}
