import { useEffect, useState } from "react";
import api from "./lib/api";

function Protected() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchProtected = async () => {
      try {
        const res = await api.get("/api/protected");
        setData(res.data);
      } catch (err) {
        console.log(err.response?.data);
        alert("Access denied ❌");
      }
    };

    fetchProtected();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Protected Page 🔒</h2>

      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <p>Loading...</p>}
    </div>
  );
}

export default Protected;
