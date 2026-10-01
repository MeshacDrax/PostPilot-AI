import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/api";

export function useLoad<T>(url: string, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(url);
      setData(response.data[key]);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, [url]);
  return { data, error, loading, reload, setData };
}
