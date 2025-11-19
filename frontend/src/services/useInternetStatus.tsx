import { useState, useEffect } from "react";

const useInternetStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const checkRealInternet = async () => {
    try {
      await fetch("https://www.google.com/favicon.ico", {
        method: "HEAD",
        mode: "no-cors",
      });
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkRealInternet();

    const handleOnline: any = () => checkRealInternet();
    const handleOffline: any = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval: any = setInterval(() => {
      checkRealInternet();
    }, 5 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return isOnline;
};

export default useInternetStatus;
