import { useEffect, useState } from "react";

export default function useDetailData(fetcher, id) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetcher(id);
        if (!alive) return;

        setItem(res?.data?.data ?? null);
      } catch (err) {
        if (!alive) return;

        setError(
          err?.response?.data?.error ||
            err?.message ||
            "Failed to load details",
        );
        setItem(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [fetcher, id]);

  return { item, loading, error };
}