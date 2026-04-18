import { useEffect, useState } from "react";

export default function useDetail(fetchFn, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchFn(id);
        setData(res.data.data);
      } catch (err) {
        console.error("Detail fetch failed", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) load();
  }, [id]);

  return { data, loading };
}